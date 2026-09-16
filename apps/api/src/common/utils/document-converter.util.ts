import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { convertDocument } from '@matbee/libreoffice-converter';

/**
 * Locate native LibreOffice executable
 */
function findLibreOfficeBinary(): string | null {
  const envPath = process.env.LIBREOFFICE_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
          'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
          'soffice',
        ]
      : [
          '/usr/bin/soffice',
          '/usr/bin/libreoffice',
          '/usr/local/bin/soffice',
          '/usr/lib/libreoffice/program/soffice',
          'soffice',
        ];

  for (const candidate of candidates) {
    if (candidate === 'soffice') {
      return 'soffice';
    }
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Convert Excel buffer to PDF using native LibreOffice CLI
 */
function convertWithNativeLibreOffice(
  binary: string,
  excelBuffer: Buffer,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let tmpDir: string | null = null;
    try {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-conv-'));
      const inputPath = path.join(tmpDir, 'document.xlsx');
      const outputPath = path.join(tmpDir, 'document.pdf');

      fs.writeFileSync(inputPath, excelBuffer);

      execFile(
        binary,
        ['--headless', '--convert-to', 'pdf', '--outdir', tmpDir, inputPath],
        { timeout: 60000 },
        (err, _stdout, stderr) => {
          try {
            if (err) {
              return reject(
                new Error(
                  `Native LibreOffice conversion failed: ${err.message || stderr}`,
                ),
              );
            }
            if (!fs.existsSync(outputPath)) {
              return reject(
                new Error(
                  `Native LibreOffice conversion produced no output file at ${outputPath}`,
                ),
              );
            }
            const pdfBuffer = fs.readFileSync(outputPath);
            resolve(pdfBuffer);
          } finally {
            if (tmpDir && fs.existsSync(tmpDir)) {
              fs.rmSync(tmpDir, { recursive: true, force: true });
            }
          }
        },
      );
    } catch (err) {
      if (tmpDir && fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/**
 * Locate directory containing LibreOffice WASM binaries
 */
function findWasmDir(): string | null {
  if (process.env.WASM_PATH && fs.existsSync(process.env.WASM_PATH)) {
    return path.resolve(process.env.WASM_PATH);
  }

  try {
    const pkgPath =
      require.resolve('@matbee/libreoffice-converter/package.json');
    const resolvedWasm = path.join(path.dirname(pkgPath), 'wasm');
    if (fs.existsSync(resolvedWasm)) return resolvedWasm;
  } catch {
    // ignore
  }

  const candidates = [
    path.resolve(process.cwd(), 'wasm'),
    '/app/wasm',
    path.resolve(
      process.cwd(),
      'node_modules/@matbee/libreoffice-converter/wasm',
    ),
    path.resolve(
      process.cwd(),
      'apps/api/node_modules/@matbee/libreoffice-converter/wasm',
    ),
    path.resolve(
      __dirname,
      '../../../../node_modules/@matbee/libreoffice-converter/wasm',
    ),
    '/app/node_modules/@matbee/libreoffice-converter/wasm',
    '/app/apps/api/node_modules/@matbee/libreoffice-converter/wasm',
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Convert Excel buffer to PDF using LibreOffice WASM
 */
async function convertWithWasm(
  excelBuffer: Buffer,
  wasmDir: string,
): Promise<Buffer> {
  process.env.WASM_PATH = wasmDir;
  const result = await convertDocument(
    excelBuffer,
    { outputFormat: 'pdf' },
    { wasmPath: wasmDir },
  );
  return Buffer.from(result.data);
}

/**
 * Convert Excel buffer to PDF using Native LibreOffice with WASM fallback
 * @param excelBuffer - Excel file as Buffer
 * @returns PDF file as Buffer
 */
export async function excelToPdf(excelBuffer: Buffer): Promise<Buffer> {
  const nativeBin = findLibreOfficeBinary();
  if (nativeBin) {
    try {
      return await convertWithNativeLibreOffice(nativeBin, excelBuffer);
    } catch (nativeError: unknown) {
      const msg =
        nativeError instanceof Error
          ? nativeError.message
          : String(nativeError);
      console.warn(
        `Native LibreOffice conversion failed, falling back to WASM: ${msg}`,
      );
    }
  }

  const wasmDir = findWasmDir();
  if (wasmDir) {
    try {
      return await convertWithWasm(excelBuffer, wasmDir);
    } catch (wasmError: unknown) {
      const msg =
        wasmError instanceof Error ? wasmError.message : String(wasmError);
      throw new Error(
        `Document conversion failed with WASM (dir: ${wasmDir}): ${msg}`,
      );
    }
  }

  throw new Error(
    'No document converter available: neither native LibreOffice (soffice) nor WASM directory could be located. Please ensure LibreOffice is installed or WASM files are placed at /app/wasm.',
  );
}
