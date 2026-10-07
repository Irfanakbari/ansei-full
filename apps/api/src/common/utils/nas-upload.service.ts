// Irfan Akbari Vuteq Indonesia
import { Injectable, Logger } from '@nestjs/common';
import { isIP } from 'node:net';

function isPrivateLanIPv4(host: string): boolean {
  if (isIP(host) !== 4) return false;
  const [first, second] = host.split('.').map(Number);
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

export interface NasUploadFile {
  fileName: string;
  fileBuffer: Buffer;
  subFolder?: string;
  signal?: AbortSignal;
}

const REQUEST_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const LOGOUT_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_RETRIES = 2;
const MAX_CONCURRENT_REQUESTS = 8;

interface NasApiResponse {
  success: boolean;
  data?: { sid?: string };
  error?: { code?: number };
}

/**
 * Upload file ke Synology NAS via FileStation HTTP API.
 * Tidak menggunakan SMB (NTLM) sehingga kompatibel dengan domain AD (NTLMv2).
 *
 * Synology FileStation API docs:
 * https://global.download.synology.com/download/Document/Software/DeveloperGuide/Package/FileStation/All/enu/Synology_FileStation_API_Guide.pdf
 */
@Injectable()
export class NasUploadService {
  private readonly logger = new Logger(NasUploadService.name);

  private readonly NAS_HOST = process.env.NAS_HOST?.trim();
  private readonly NAS_PORT = process.env.NAS_PORT?.trim();
  private readonly NAS_PROTOCOL = process.env.NAS_PROTOCOL?.trim();
  private readonly NAS_USER = process.env.NAS_USER?.trim();
  private readonly NAS_PASSWORD = process.env.NAS_PASSWORD;

  /**
   * Nama share / folder yang di-share di Synology (shared folder name).
   * Contoh: 'AssetStorage'
   */
  private readonly NAS_SMB_SHARE = process.env.NAS_SMB_SHARE?.trim();

  /**
   * Subfolder di dalam share sebagai base path untuk semua file.
   * Contoh: 'ProductionAttachment'
   */
  private readonly NAS_SMB_SUBFOLDER = process.env.NAS_SMB_SUBFOLDER?.trim();

  /**
   * URL publik base untuk digunakan sebagai file URL yang disimpan di DB.
   */
  private readonly NAS_BASE_URL = process.env.NAS_BASE_URL?.trim();
  private activeRequests = 0;
  private readonly waiters: Array<() => void> = [];

  private getConfig(): {
    host: string;
    port: string;
    protocol: 'http' | 'https';
    user: string;
    password: string;
    share: string;
    subfolder: string;
    baseUrl: URL;
  } {
    const missing = [
      ['NAS_HOST', this.NAS_HOST],
      ['NAS_PORT', this.NAS_PORT],
      ['NAS_PROTOCOL', this.NAS_PROTOCOL],
      ['NAS_USER', this.NAS_USER],
      ['NAS_PASSWORD', this.NAS_PASSWORD],
      ['NAS_SMB_SHARE', this.NAS_SMB_SHARE],
      ['NAS_SMB_SUBFOLDER', this.NAS_SMB_SUBFOLDER],
      ['NAS_BASE_URL', this.NAS_BASE_URL],
    ].filter(([, value]) => !value);

    if (missing.length > 0) {
      throw new Error(
        `NAS configuration is incomplete: ${missing.map(([name]) => name).join(', ')}`,
      );
    }

    if (this.NAS_PROTOCOL !== 'http' && this.NAS_PROTOCOL !== 'https') {
      throw new Error('NAS_PROTOCOL must be http or https');
    }
    const baseUrl = new URL(this.NAS_BASE_URL as string);
    if (!['http:', 'https:'].includes(baseUrl.protocol)) {
      throw new Error('NAS_BASE_URL must use http or https');
    }

    const privateHttpAllowed =
      process.env.NAS_ALLOW_HTTP_PRIVATE_NETWORK === 'true' &&
      this.NAS_PROTOCOL === 'http' &&
      baseUrl.protocol === 'http:' &&
      isPrivateLanIPv4(this.NAS_HOST as string) &&
      baseUrl.hostname === this.NAS_HOST;
    if (
      process.env.NODE_ENV === 'production' &&
      (this.NAS_PROTOCOL !== 'https' || baseUrl.protocol !== 'https:') &&
      !privateHttpAllowed
    ) {
      throw new Error(
        'NAS in production requires HTTPS or explicit HTTP access to a matching private LAN IPv4 host',
      );
    }

    return {
      host: this.NAS_HOST as string,
      port: this.NAS_PORT as string,
      protocol: this.NAS_PROTOCOL,
      user: this.NAS_USER as string,
      password: this.NAS_PASSWORD as string,
      share: this.NAS_SMB_SHARE as string,
      subfolder: this.NAS_SMB_SUBFOLDER as string,
      baseUrl,
    };
  }

  private get baseApiUrl(): string {
    const config = this.getConfig();
    return `${config.protocol}://${config.host}:${config.port}/webapi`;
  }

  // ---------------------------------------------------------------------------
  // FileStation Session helper
  // ---------------------------------------------------------------------------

  /**
   * Login ke Synology FileStation API dan dapatkan SID (session token).
   */
  private async login(signal?: AbortSignal): Promise<string> {
    const config = this.getConfig();
    // Build URL with proper encoding using URLSearchParams for all parameters
    const baseParams = new URLSearchParams({
      api: 'SYNO.API.Auth',
      version: '3',
      method: 'login',
      account: config.user,
      passwd: config.password,
      session: 'FileStation',
      format: 'sid',
    });

    const url = `${this.baseApiUrl}/auth.cgi?${baseParams.toString()}`;

    let res: Response;
    try {
      res = await this.fetchWithRetry(url, {}, signal);
    } catch (error) {
      this.logger.error('NAS connection failed');
      if (signal?.aborted) throw error;
      throw new Error('NAS connection failed');
    }

    if (!res.ok) {
      throw new Error(`NAS login HTTP error: ${res.status}`);
    }

    let json: {
      success: boolean;
      data?: { sid?: string };
      error?: { code?: number };
    };
    try {
      json = await this.readJson(res);
    } catch {
      throw new Error('NAS login returned an invalid response');
    }

    if (!json.success) {
      throw new Error(`NAS login failed: error code ${json.error?.code}`);
    }

    if (!json.data?.sid)
      throw new Error('NAS login response did not include a session');
    return json.data.sid;
  }

  /**
   * Logout dari Synology FileStation API.
   */
  private async logout(sid: string): Promise<void> {
    try {
      const params = new URLSearchParams({
        api: 'SYNO.API.Auth',
        version: '1',
        method: 'logout',
        session: 'FileStation',
        _sid: sid,
      });
      await this.fetchOnce(
        `${this.baseApiUrl}/auth.cgi?${params.toString()}`,
        {},
        undefined,
        LOGOUT_TIMEOUT_MS,
      );
    } catch {
      // non-critical
    }
  }

  // ---------------------------------------------------------------------------
  // Public methods
  // ---------------------------------------------------------------------------

  /**
   * Upload file ke Synology NAS via FileStation API.
   * Mengembalikan URL publik file yang disimpan di DB.
   */
  async uploadFile(dto: NasUploadFile): Promise<string> {
    const config = this.getConfig();
    const fileName = this.validatePathSegment(dto.fileName, 'file name');
    const subFolder = dto.subFolder
      ? this.validateRelativePath(dto.subFolder, 'subfolder')
      : '';
    const sid = await this.login(dto.signal);

    try {
      // Path tujuan di dalam share: /AssetStorage/ProductionAttachment/production-release-id
      const nestedFolder = subFolder ? `/${subFolder}` : '';
      const destFolderPath = `/${config.share}/${config.subfolder}${nestedFolder}`;

      // Buat folder rekursif jika belum ada
      await this.ensureDirectory(sid, destFolderPath, dto.signal);

      // Upload file menggunakan multipart/form-data
      const formData = new FormData();
      formData.append('api', 'SYNO.FileStation.Upload');
      formData.append('version', '2');
      formData.append('method', 'upload');
      formData.append('_sid', sid);
      formData.append('path', destFolderPath);
      formData.append('create_parents', 'true');
      formData.append('overwrite', 'true');

      const blob = new Blob([new Uint8Array(dto.fileBuffer)]);
      formData.append('file', blob, fileName);

      // _sid harus ada di query string URL, bukan hanya di form body
      const uploadUrl = `${this.baseApiUrl}/entry.cgi?_sid=${encodeURIComponent(sid)}`;
      const uploadRes = await this.fetchWithRetry(
        uploadUrl,
        {
          method: 'POST',
          body: formData,
        },
        dto.signal,
        false,
      );

      if (!uploadRes.ok) {
        throw new Error(
          `NAS upload HTTP error: ${uploadRes.status} ${uploadRes.statusText}`,
        );
      }

      const uploadJson = await this.readJson<NasApiResponse>(uploadRes);
      if (!uploadJson.success) {
        throw new Error(
          `NAS upload failed: error code ${uploadJson.error?.code}`,
        );
      }

      this.logger.log('File uploaded to NAS');
      return this.buildPublicUrl(subFolder, fileName);
    } finally {
      await this.logout(sid);
    }
  }

  /**
   * Hapus file dari Synology NAS.
   * publicUrl adalah URL yang tersimpan di DB.
   */
  async deleteFile(publicUrl: string): Promise<void> {
    const nasPath = this.publicUrlToNasPath(publicUrl);
    if (!nasPath) {
      this.logger.warn('Cannot resolve NAS path from URL');
      return;
    }

    const sid = await this.login();

    try {
      const params = new URLSearchParams({
        api: 'SYNO.FileStation.Delete',
        version: '2',
        method: 'start',
        path: JSON.stringify([nasPath]),
        _sid: sid,
      });

      const res = await this.fetchWithRetry(
        `${this.baseApiUrl}/entry.cgi?${params.toString()}`,
        {},
        undefined,
        false,
      );

      if (!res.ok) {
        throw new Error(`NAS delete HTTP error: ${res.status}`);
      }

      const json = await this.readJson<NasApiResponse>(res);
      if (!json.success) {
        this.logger.warn(`NAS delete failed: error code ${json.error?.code}`);
      } else {
        this.logger.log('File deleted from NAS');
      }
    } finally {
      await this.logout(sid);
    }
  }

  /**
   * Cek apakah file ada di Synology NAS.
   */
  async fileExists(publicUrl: string): Promise<boolean> {
    const nasPath = this.publicUrlToNasPath(publicUrl);
    if (!nasPath) return false;

    const sid = await this.login();

    try {
      const params = new URLSearchParams({
        api: 'SYNO.FileStation.List',
        version: '2',
        method: 'getinfo',
        path: JSON.stringify([nasPath]),
        _sid: sid,
      });

      const res = await this.fetchWithRetry(
        `${this.baseApiUrl}/entry.cgi?${params.toString()}`,
      );
      const json = await this.readJson<NasApiResponse>(res);
      return json.success === true;
    } finally {
      await this.logout(sid);
    }
  }

  /**
   * Download / stream file dari Synology NAS via FileStation Download API.
   * publicUrl adalah URL yang tersimpan di DB.
   * Mengembalikan Response object dari fetch sehingga controller bisa pipe body-nya.
   */
  async downloadFile(
    publicUrl: string,
    signal?: AbortSignal,
  ): Promise<{
    response: Response;
    fileName: string;
    contentType: string;
  }> {
    const nasPath = this.publicUrlToNasPath(publicUrl);
    if (!nasPath) {
      throw new Error('Cannot resolve NAS path from URL');
    }

    const sid = await this.login(signal);

    const fileName = nasPath.split('/').pop() || 'file';

    const params = new URLSearchParams({
      api: 'SYNO.FileStation.Download',
      version: '2',
      method: 'download',
      path: JSON.stringify([nasPath]),
      mode: 'download',
      _sid: sid,
    });

    let res: Response;
    try {
      res = await this.fetchWithRetry(
        `${this.baseApiUrl}/entry.cgi?${params.toString()}`,
        {},
        signal,
        true,
        DOWNLOAD_TIMEOUT_MS,
      );
      if (!res.ok) throw new Error(`NAS download HTTP error: ${res.status}`);
    } catch (error) {
      await this.logout(sid);
      throw error;
    }

    const body = res.body;
    if (!body) {
      await this.logout(sid);
      throw new Error('NAS download returned an empty body');
    }
    const reader = body.getReader();
    let closed = false;
    const abortStream = () => {
      void reader.cancel(signal?.reason).finally(() => closeSession());
    };
    const closeSession = async () => {
      if (closed) return;
      closed = true;
      signal?.removeEventListener('abort', abortStream);
      await this.logout(sid);
    };
    signal?.addEventListener('abort', abortStream, { once: true });
    const wrappedBody = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const chunk = await reader.read();
          if (chunk.done) {
            controller.close();
            await closeSession();
          } else {
            controller.enqueue(chunk.value);
          }
        } catch (error) {
          controller.error(error);
          await closeSession();
        }
      },
      async cancel(reason) {
        try {
          await reader.cancel(reason);
        } finally {
          await closeSession();
        }
      },
    });

    const contentType =
      res.headers.get('content-type') || 'application/octet-stream';

    return { response: new Response(wrappedBody, res), fileName, contentType };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Buat directory secara rekursif menggunakan FileStation API.
   * path format: /ShareName/folder/subfolder
   */
  private async ensureDirectory(
    sid: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      // SYNO.FileStation.CreateFolder:
      // folder_path = parent directory (tempat folder baru dibuat)
      // name        = nama folder baru yang ingin dibuat
      // force_parent = buat parent secara rekursif jika belum ada
      const lastSlash = path.lastIndexOf('/');
      const parentPath = lastSlash > 0 ? path.substring(0, lastSlash) : '/';
      const folderName = path.substring(lastSlash + 1);

      if (!folderName) return; // root path, skip

      const params = new URLSearchParams({
        api: 'SYNO.FileStation.CreateFolder',
        version: '2',
        method: 'create',
        folder_path: JSON.stringify([parentPath]),
        name: JSON.stringify([folderName]),
        force_parent: 'true',
        _sid: sid,
      });

      const res = await this.fetchWithRetry(
        `${this.baseApiUrl}/entry.cgi?${params.toString()}`,
        {},
        signal,
      );
      const json = await this.readJson<NasApiResponse>(res);

      if (!json.success) {
        const code = json.error?.code;
        // 1104 = folder already exists — tidak apa-apa
        if (code !== 1104) {
          this.logger.debug(`ensureDirectory response code=${code}`);
        }
      } else {
        this.logger.debug('Created NAS directory');
      }
    } catch (error) {
      this.logger.warn('ensureDirectory failed');
      throw error;
    }
  }

  private buildPublicUrl(subFolder: string, fileName: string): string {
    const config = this.getConfig();
    const folder = subFolder ? `/${subFolder.replace(/\\/g, '/')}` : '';
    return new URL(
      `${folder.replace(/^\//, '')}${folder ? '/' : ''}${fileName}`,
      `${config.baseUrl.toString().replace(/\/$/, '')}/`,
    ).toString();
  }

  /**
   * Konversi URL publik → NAS path.
   * Contoh: "http://192.168.1.15:8080/ProductionAttachment/release-id/file.pdf"
   *       → "/AssetStorage/ProductionAttachment/release-id/file.pdf"
   */
  private publicUrlToNasPath(publicUrl: string): string | null {
    const config = this.getConfig();
    if (!publicUrl || publicUrl !== publicUrl.trim()) return null;

    try {
      if (
        /[^\x20-\x7e]/.test(publicUrl) ||
        /%25/i.test(publicUrl) ||
        /(?:^|\/)(?:\.|%2e)(?:\.|%2e)?(?:\/|$)/i.test(publicUrl)
      )
        return null;
      if (/%(?:2f|5c)/i.test(publicUrl)) return null;

      let pathname: string;
      if (publicUrl.startsWith('/')) {
        if (publicUrl.startsWith('//') || /[?#]/.test(publicUrl)) return null;
        pathname = publicUrl;
      } else {
        const url = new URL(publicUrl);
        if (
          url.origin !== config.baseUrl.origin ||
          url.username ||
          url.password ||
          url.search ||
          url.hash
        )
          return null;
        pathname = url.pathname;
      }

      const decodedPath = decodeURIComponent(pathname);
      if (/[^\x20-\x7e]/.test(decodedPath) || decodedPath.includes('\\'))
        return null;
      const segments = decodedPath.split('/').filter(Boolean);
      if (
        segments.length === 0 ||
        segments.some((segment) => segment === '.' || segment === '..')
      )
        return null;

      const managedSegments = [config.share, config.subfolder];
      const baseSegments = config.baseUrl.pathname
        .split('/')
        .filter(Boolean)
        .map((segment) => decodeURIComponent(segment));
      const startsWith = (prefix: string[]) =>
        prefix.every((segment, index) => segments[index] === segment);

      let relativeSegments: string[];
      if (startsWith(managedSegments)) {
        relativeSegments = segments.slice(managedSegments.length);
      } else if (baseSegments.length > 0 && startsWith(baseSegments)) {
        relativeSegments = segments.slice(baseSegments.length);
      } else {
        return null;
      }

      if (relativeSegments.length === 0) return null;
      return `/${[...managedSegments, ...relativeSegments].join('/')}`;
    } catch {
      this.logger.warn('Failed to parse public URL');
      return null;
    }
  }

  private validatePathSegment(value: string, label: string): string {
    const hasControlCharacter = [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    });
    if (
      !value ||
      value !== value.trim() ||
      value === '.' ||
      value === '..' ||
      hasControlCharacter ||
      /[/\\]/.test(value) ||
      /%(?:25|2e|2f|5c)/i.test(value)
    ) {
      throw new Error(`Invalid NAS ${label}`);
    }
    return value;
  }

  private validateRelativePath(value: string, label: string): string {
    if (value.startsWith('/') || value.endsWith('/') || value.includes('\\')) {
      throw new Error(`Invalid NAS ${label}`);
    }
    return value
      .split('/')
      .map((segment) => this.validatePathSegment(segment, label))
      .join('/');
  }

  /**
   * Remap old format URL or path (with NAS_SMB_SHARE) to the new format URL (with port 8080 and without NAS_SMB_SHARE).
   * Contoh: "http://192.168.1.15/AssetStorage/ProductionAttachment/release-id/file.pdf"
   *       → "http://192.168.1.15:8080/ProductionAttachment/release-id/file.pdf"
   */
  remapUrlToNewFormat(publicUrl: string): string {
    if (!publicUrl) return publicUrl;
    try {
      const config = this.getConfig();
      let pathname = '';
      if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) {
        const url = new URL(publicUrl);
        pathname = url.pathname;
      } else {
        pathname = publicUrl;
      }

      if (!pathname.startsWith('/')) {
        pathname = '/' + pathname;
      }

      // Jika path mengandung /NAS_SMB_SHARE/, buang prefix tersebut
      const sharePrefix = `/${config.share}/`;
      if (pathname.startsWith(sharePrefix)) {
        pathname = '/' + pathname.substring(sharePrefix.length);
      } else if (pathname === `/${config.share}`) {
        pathname = '/';
      }

      return new URL(
        pathname.replace(/^\//, ''),
        `${config.baseUrl.origin}/`,
      ).toString();
    } catch {
      return publicUrl;
    }
  }

  private async acquire(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    if (this.activeRequests < MAX_CONCURRENT_REQUESTS) {
      this.activeRequests += 1;
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const resume = () => {
        signal?.removeEventListener('abort', abort);
        resolve();
      };
      const abort = () => {
        const index = this.waiters.indexOf(resume);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(
          signal?.reason instanceof Error
            ? signal.reason
            : new Error('NAS request aborted'),
        );
      };
      signal?.addEventListener('abort', abort, { once: true });
      this.waiters.push(resume);
    });
    this.activeRequests += 1;
  }

  private release(): void {
    this.activeRequests -= 1;
    this.waiters.shift()?.();
  }

  private async fetchOnce(
    input: string,
    init: RequestInit = {},
    signal?: AbortSignal,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<Response> {
    await this.acquire(signal);
    const timeout = AbortSignal.timeout(timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      return await fetch(input, { ...init, signal: combined });
    } finally {
      this.release();
    }
  }

  private async fetchWithRetry(
    input: string,
    init: RequestInit = {},
    signal?: AbortSignal,
    retryable = true,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<Response> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const response = await this.fetchOnce(input, init, signal, timeoutMs);
        if (
          !retryable ||
          attempt >= MAX_RETRIES ||
          ![429, 502, 503, 504].includes(response.status)
        )
          return response;
      } catch (error) {
        if (signal?.aborted || attempt >= MAX_RETRIES || !retryable)
          throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }

  private async readJson<T>(response: Response): Promise<T> {
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > MAX_RESPONSE_BYTES) throw new Error('NAS response too large');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_RESPONSE_BYTES)
      throw new Error('NAS response too large');
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  }
}
