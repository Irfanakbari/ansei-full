import { NasUploadService } from './nas-upload.service';

const loginResponse = () =>
  new Response(JSON.stringify({ success: true, data: { sid: 'session' } }), {
    headers: { 'content-type': 'application/json' },
  });
const successResponse = () =>
  new Response(JSON.stringify({ success: true }), {
    headers: { 'content-type': 'application/json' },
  });

describe('NasUploadService', () => {
  beforeEach(() => {
    process.env.NAS_HOST = 'nas.internal';
    process.env.NAS_PORT = '5001';
    process.env.NAS_PROTOCOL = 'https';
    process.env.NAS_USER = 'user';
    process.env.NAS_PASSWORD = 'secret';
    process.env.NAS_SMB_SHARE = 'share';
    process.env.NAS_SMB_SUBFOLDER = 'uploads';
    process.env.NAS_BASE_URL = 'https://files.example.test/uploads/';
    jest.restoreAllMocks();
  });

  it('logs out when an upload is aborted after login', async () => {
    const controller = new AbortController();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(loginResponse())
      .mockImplementationOnce(() => {
        controller.abort();
        return Promise.reject(new Error('aborted'));
      })
      .mockResolvedValueOnce(successResponse());

    await expect(
      new NasUploadService().uploadFile({
        fileName: 'file.pdf',
        fileBuffer: Buffer.from('%PDF-1.7'),
        signal: controller.signal,
      }),
    ).rejects.toBeDefined();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toContain('method=logout');
  });

  it('logs out after a successful upload', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(successResponse())
      .mockResolvedValueOnce(successResponse())
      .mockResolvedValueOnce(successResponse());

    await expect(
      new NasUploadService().uploadFile({
        fileName: 'file.pdf',
        fileBuffer: Buffer.from('%PDF-1.7'),
      }),
    ).resolves.toBe('https://files.example.test/uploads/file.pdf');
    expect(fetchMock.mock.calls[3][0]).toContain('method=logout');
  });

  it('logs out after an upload error', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(successResponse())
      .mockResolvedValueOnce(new Response('failed', { status: 500 }))
      .mockResolvedValueOnce(successResponse());

    await expect(
      new NasUploadService().uploadFile({
        fileName: 'file.pdf',
        fileBuffer: Buffer.from('%PDF-1.7'),
      }),
    ).rejects.toThrow('NAS upload HTTP error');
    expect(fetchMock.mock.calls[3][0]).toContain('method=logout');
  });

  it('logs out after the download stream completes', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(
        new Response(Buffer.from('content'), { status: 200 }),
      )
      .mockResolvedValueOnce(successResponse());

    const download = await new NasUploadService().downloadFile(
      'https://files.example.test/uploads/release/file.pdf',
    );
    expect(await download.response.text()).toBe('content');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toContain('method=logout');
  });

  it('logs out after a download error', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(new Response('failed', { status: 500 }))
      .mockResolvedValueOnce(successResponse());

    await expect(
      new NasUploadService().downloadFile(
        'https://files.example.test/uploads/release/file.pdf',
      ),
    ).rejects.toThrow('NAS download HTTP error');
    expect(fetchMock.mock.calls[2][0]).toContain('method=logout');
  });

  it('logs out when a download stream is cancelled', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(new Response(Buffer.from('content')))
      .mockResolvedValueOnce(successResponse());

    const download = await new NasUploadService().downloadFile(
      'https://files.example.test/uploads/release/file.pdf',
    );
    await download.response.body?.cancel(new Error('client disconnected'));
    expect(fetchMock.mock.calls[2][0]).toContain('method=logout');
  });

  it.each([
    'https://evil.example/uploads/release/file.pdf',
    'https://files.example.test/uploads/../secret.pdf',
    'https://files.example.test/uploads/%2e%2e/secret.pdf',
    'https://files.example.test/uploads/release%2ffile.pdf',
    'https://files.example.test/uploads/release%252ffile.pdf',
    'https://files.example.test/uploads/release/file.pdf?download=1',
    '/share/uploads',
    '/uploads',
    '/other/file.pdf',
    '/uploads/release/file\u0000.pdf',
  ])(
    'rejects an untrusted download path without accessing NAS: %s',
    async (path) => {
      const fetchMock = jest.spyOn(global, 'fetch');

      await expect(new NasUploadService().downloadFile(path)).rejects.toThrow(
        'Cannot resolve NAS path from URL',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    'https://evil.example/uploads/file.pdf',
    '/uploads/../file.pdf',
    '/uploads/release%5cfile.pdf',
  ])('fails closed for invalid existence paths: %s', async (path) => {
    const fetchMock = jest.spyOn(global, 'fetch');

    await expect(new NasUploadService().fileExists(path)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    'https://evil.example/uploads/file.pdf',
    '/share/uploads',
    '/uploads/%252e%252e/file.pdf',
  ])('fails closed for invalid delete paths: %s', async (path) => {
    const fetchMock = jest.spyOn(global, 'fetch');

    await expect(
      new NasUploadService().deleteFile(path),
    ).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      'https://files.example.test/uploads/release/file.pdf',
      '/share/uploads/release/file.pdf',
    ],
    ['/uploads/release/file.pdf', '/share/uploads/release/file.pdf'],
    ['/share/uploads/release/file.pdf', '/share/uploads/release/file.pdf'],
  ])('accepts a managed file path: %s', async (path, expectedNasPath) => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValueOnce(successResponse())
      .mockResolvedValueOnce(successResponse());

    await expect(new NasUploadService().fileExists(path)).resolves.toBe(true);
    const requestUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(JSON.parse(requestUrl.searchParams.get('path') as string)).toEqual([
      expectedNasPath,
    ]);
  });

  it.each([
    { fileName: '../file.pdf' },
    { fileName: 'folder/file.pdf' },
    { fileName: 'file%252epdf' },
    { fileName: 'file.pdf', subFolder: '../release' },
    { fileName: 'file.pdf', subFolder: '/release' },
    { fileName: 'file.pdf', subFolder: 'release\\nested' },
  ])('rejects invalid upload paths before accessing NAS: %o', async (input) => {
    const fetchMock = jest.spyOn(global, 'fetch');

    await expect(
      new NasUploadService().uploadFile({
        fileBuffer: Buffer.from('%PDF-1.7'),
        ...input,
      }),
    ).rejects.toThrow('Invalid NAS');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
