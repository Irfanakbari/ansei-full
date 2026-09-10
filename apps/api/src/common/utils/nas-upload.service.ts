// Irfan Akbari Vuteq Indonesia
import { Injectable, Logger } from '@nestjs/common';

export interface NasUploadFile {
  fileName: string;
  fileBuffer: Buffer;
  subFolder?: string;
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

  private readonly NAS_HOST = process.env.NAS_HOST || '192.168.1.15';
  private readonly NAS_PORT = process.env.NAS_PORT || '5000'; // 5001 untuk HTTPS
  private readonly NAS_PROTOCOL = process.env.NAS_PROTOCOL || 'http';
  private readonly NAS_USER = process.env.NAS_USER || 'tes';
  private readonly NAS_PASSWORD = process.env.NAS_PASSWORD || 'P@ta';

  /**
   * Nama share / folder yang di-share di Synology (shared folder name).
   * Contoh: 'AssetStorage'
   */
  private readonly NAS_SMB_SHARE = process.env.NAS_SMB_SHARE || 'AssetStorage';

  /**
   * Subfolder di dalam share sebagai base path untuk semua file.
   * Contoh: 'ProductionAttachment'
   */
  private readonly NAS_SMB_SUBFOLDER =
    process.env.NAS_SMB_SUBFOLDER || 'Ansei_Asset';

  /**
   * URL publik base untuk digunakan sebagai file URL yang disimpan di DB.
   */
  private readonly NAS_BASE_URL =
    process.env.NAS_BASE_URL || 'http://192.168.1.15/AssetStorage/Ansei_Asset';

  private get baseApiUrl(): string {
    const url = `${this.NAS_PROTOCOL}://${this.NAS_HOST}:${this.NAS_PORT}/webapi`;
    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid NAS configuration: ${url}`);
    }
    return url;
  }

  /**
   * Validate that a string is a valid URL
   */
  private isValidUrl(urlString: string): boolean {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // FileStation Session helper
  // ---------------------------------------------------------------------------

  /**
   * Login ke Synology FileStation API dan dapatkan SID (session token).
   */
  private async login(): Promise<string> {
    // Build URL with proper encoding using URLSearchParams for all parameters
    const baseParams = new URLSearchParams({
      api: 'SYNO.API.Auth',
      version: '3',
      method: 'login',
      account: this.NAS_USER,
      passwd: this.NAS_PASSWORD,
      session: 'FileStation',
      format: 'sid',
    });

    const url = `${this.baseApiUrl}/auth.cgi?${baseParams.toString()}`;

    this.logger.debug(
      `NAS login URL: ${url.replace(this.NAS_PASSWORD, '***')}`,
    );

    let res: Response;
    try {
      res = await fetch(url);
    } catch (fetchError) {
      this.logger.error(`NAS fetch error: ${fetchError}`);
      throw new Error(`NAS connection failed: ${fetchError}`);
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      throw new Error(
        `NAS login HTTP error: ${res.status} ${res.statusText} - ${errorText}`,
      );
    }

    let json: {
      success: boolean;
      data?: { sid?: string };
      error?: { code?: number };
    };
    try {
      json = await res.json();
    } catch (parseError) {
      const responseText = await res.text().catch(() => 'Unknown');
      throw new Error(
        `NAS login response parse error: ${parseError}, response: ${responseText}`,
      );
    }

    if (!json.success) {
      throw new Error(`NAS login failed: error code ${json.error?.code}`);
    }

    return json.data?.sid as string;
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
      await fetch(`${this.baseApiUrl}/auth.cgi?${params.toString()}`);
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
    const sid = await this.login();

    try {
      // Path tujuan di dalam share: /AssetStorage/ProductionAttachment/production-release-id
      const subFolder = dto.subFolder
        ? `/${dto.subFolder.replace(/\\/g, '/')}`
        : '';
      const destFolderPath = `/${this.NAS_SMB_SHARE}/${this.NAS_SMB_SUBFOLDER}${subFolder}`;

      // Buat folder rekursif jika belum ada
      await this.ensureDirectory(sid, destFolderPath);

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
      formData.append('file', blob, dto.fileName);

      // _sid harus ada di query string URL, bukan hanya di form body
      const uploadUrl = `${this.baseApiUrl}/entry.cgi?_sid=${encodeURIComponent(sid)}`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error(
          `NAS upload HTTP error: ${uploadRes.status} ${uploadRes.statusText}`,
        );
      }

      const uploadJson = await uploadRes.json();
      if (!uploadJson.success) {
        throw new Error(
          `NAS upload failed: error code ${uploadJson.error?.code}`,
        );
      }

      this.logger.log(
        `File uploaded to NAS: ${destFolderPath}/${dto.fileName}`,
      );
      return this.buildPublicUrl(dto.subFolder ?? '', dto.fileName);
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
      this.logger.warn(`Cannot resolve NAS path from URL: ${publicUrl}`);
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

      const res = await fetch(
        `${this.baseApiUrl}/entry.cgi?${params.toString()}`,
      );

      if (!res.ok) {
        throw new Error(`NAS delete HTTP error: ${res.status}`);
      }

      const json = await res.json();
      if (!json.success) {
        this.logger.warn(
          `NAS delete failed for ${nasPath}: error code ${json.error?.code}`,
        );
      } else {
        this.logger.log(`File deleted from NAS: ${nasPath}`);
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

      const res = await fetch(
        `${this.baseApiUrl}/entry.cgi?${params.toString()}`,
      );
      const json = await res.json();
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
  async downloadFile(publicUrl: string): Promise<{
    response: Response;
    fileName: string;
    contentType: string;
  }> {
    const nasPath = this.publicUrlToNasPath(publicUrl);
    if (!nasPath) {
      throw new Error(`Cannot resolve NAS path from URL: ${publicUrl}`);
    }

    const sid = await this.login();

    const fileName = nasPath.split('/').pop() || 'file';

    const params = new URLSearchParams({
      api: 'SYNO.FileStation.Download',
      version: '2',
      method: 'download',
      path: JSON.stringify([nasPath]),
      mode: 'download',
      _sid: sid,
    });

    const res = await fetch(
      `${this.baseApiUrl}/entry.cgi?${params.toString()}`,
    );

    if (!res.ok) {
      await this.logout(sid);
      throw new Error(`NAS download HTTP error: ${res.status}`);
    }

    // Logout dilakukan setelah stream selesai tidak bisa, jadi biarkan session expire
    // SID Synology default expire setelah beberapa menit idle

    const contentType =
      res.headers.get('content-type') || 'application/octet-stream';

    return { response: res, fileName, contentType };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Buat directory secara rekursif menggunakan FileStation API.
   * path format: /ShareName/folder/subfolder
   */
  private async ensureDirectory(sid: string, path: string): Promise<void> {
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

      const res = await fetch(
        `${this.baseApiUrl}/entry.cgi?${params.toString()}`,
      );
      const json = await res.json();

      if (!json.success) {
        const code = json.error?.code;
        // 1104 = folder already exists — tidak apa-apa
        if (code !== 1104) {
          this.logger.debug(
            `ensureDirectory response for ${path}: code=${code}`,
          );
        }
      } else {
        this.logger.debug(`Created NAS directory: ${path}`);
      }
    } catch (err) {
      this.logger.warn(`ensureDirectory failed (non-critical): ${err}`);
    }
  }

  private buildPublicUrl(subFolder: string, fileName: string): string {
    const folder = subFolder ? `/${subFolder.replace(/\\/g, '/')}` : '';
    // Format URL saved to DB: http://NAS_HOST:8080/NAS_SMB_SUBFOLDER/subFolder/fileName (without NAS_SMB_SHARE)
    return `http://${this.NAS_HOST}:8080/${this.NAS_SMB_SUBFOLDER}${folder}/${fileName}`;
  }

  /**
   * Konversi URL publik → NAS path.
   * Contoh: "http://192.168.1.15:8080/ProductionAttachment/release-id/file.pdf"
   *       → "/AssetStorage/ProductionAttachment/release-id/file.pdf"
   */
  private publicUrlToNasPath(publicUrl: string): string | null {
    if (!publicUrl) return null;

    try {
      // Normalize URL - ensure it has proper protocol
      let normalizedUrl = publicUrl.trim();
      if (
        !normalizedUrl.startsWith('http://') &&
        !normalizedUrl.startsWith('https://')
      ) {
        normalizedUrl = `http://${normalizedUrl}`;
      }

      const url = new URL(normalizedUrl);
      let path = url.pathname; // e.g. /ProductionAttachment/release-id/file.pdf

      if (!path.startsWith('/')) {
        path = '/' + path;
      }

      // Jika path tidak diawali dengan /NAS_SMB_SHARE/, tambahkan /NAS_SMB_SHARE di depannya
      const sharePrefix = `/${this.NAS_SMB_SHARE}/`;
      if (!path.startsWith(sharePrefix) && path !== `/${this.NAS_SMB_SHARE}`) {
        path = `/${this.NAS_SMB_SHARE}${path}`;
      }

      return path;
    } catch (err) {
      this.logger.warn(
        `Failed to parse public URL: ${publicUrl}, error: ${err}`,
      );
      return null;
    }
  }

  /**
   * Remap old format URL or path (with NAS_SMB_SHARE) to the new format URL (with port 8080 and without NAS_SMB_SHARE).
   * Contoh: "http://192.168.1.15/AssetStorage/ProductionAttachment/release-id/file.pdf"
   *       → "http://192.168.1.15:8080/ProductionAttachment/release-id/file.pdf"
   */
  remapUrlToNewFormat(publicUrl: string): string {
    if (!publicUrl) return publicUrl;
    try {
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
      const sharePrefix = `/${this.NAS_SMB_SHARE}/`;
      if (pathname.startsWith(sharePrefix)) {
        pathname = '/' + pathname.substring(sharePrefix.length);
      } else if (pathname === `/${this.NAS_SMB_SHARE}`) {
        pathname = '/';
      }

      return `http://${this.NAS_HOST}:8080${pathname}`;
    } catch {
      return publicUrl;
    }
  }
}
