/* By Irfan Akbari Vuteq Indonesia - 2026-10-05 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const compile = (path) =>
  ts.transpileModule(readFileSync(join(root, path), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

async function main() {
  const basePathUrl = moduleUrl(compile('lib/base-path.ts'));
  const { BASE_PATH, withBasePath, withoutBasePath } = await import(basePathUrl);

  assert.equal(BASE_PATH, '/ansei', 'Default BASE_PATH must be /ansei');
  assert.equal(withBasePath('/apps'), '/ansei/apps', 'Prefixes /apps with /ansei');
  assert.equal(withBasePath('api/health'), '/ansei/api/health', 'Normalizes path and prefixes');
  assert.equal(withBasePath('/ansei/apps'), '/ansei/apps', 'Does not duplicate prefix');
  assert.equal(withBasePath('/ansei'), '/ansei', 'Does not duplicate root prefix');

  assert.equal(withoutBasePath('/ansei'), '/', 'Strips root base path to /');
  assert.equal(withoutBasePath('/ansei/apps'), '/apps', 'Strips base path from route');
  assert.equal(withoutBasePath('/outside'), '/outside', 'Leaves unrelated path untouched');

  console.log('PASS: Base path utilities verified successfully.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
