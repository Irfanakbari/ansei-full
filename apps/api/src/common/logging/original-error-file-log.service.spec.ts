import { mkdtemp, readFile, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OriginalErrorFileLogService } from './original-error-file-log.service';

describe(OriginalErrorFileLogService.name, () => {
  let storagePath: string;

  beforeEach(async () => {
    storagePath = await mkdtemp(join(tmpdir(), 'ansei-error-log-'));
    process.env.ERROR_LOG_STORAGE_PATH = storagePath;
  });

  afterEach(() => {
    delete process.env.ERROR_LOG_STORAGE_PATH;
  });

  it('persists only allow-listed error audit metadata with secure permissions', async () => {
    const service = new OriginalErrorFileLogService();
    const exception = Object.assign(
      new Error('password=secret inventory=9000000 token=abc'),
      {
        code: 'P5001',
        cause: { supplierAccount: '1234567890' },
      },
    );

    await service.write(exception, {
      requestId: 'request-123',
      method: 'POST',
      statusCode: 500,
    });

    const fileName = (await readdir(storagePath)).find((name) =>
      name.startsWith('secure-error-'),
    );
    expect(fileName).toBeDefined();
    const filePath = join(storagePath, fileName!);
    const content = await readFile(filePath, 'utf8');
    const metadata = await stat(filePath);

    expect(content).toContain('"event":"ERROR_AUDIT"');
    expect(content).toContain('"errorCode":"P5001"');
    expect(content).toContain('"exceptionClass":"Error"');
    expect(content).not.toContain('secret');
    expect(content).not.toContain('9000000');
    expect(content).not.toContain('abc');
    expect(content).not.toContain('1234567890');
    if (process.platform !== 'win32') {
      expect(metadata.mode & 0o777).toBe(0o600);
    }
  });
});
