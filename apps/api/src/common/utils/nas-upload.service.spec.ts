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
});
