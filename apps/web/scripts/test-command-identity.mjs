/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
// Isolated browser transport contract test; no backend, account or network is used.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
const root = fileURLToPath(new URL("../", import.meta.url));
const compileSource = (source, imports = {}) =>
  ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
    transformers: {
      before: [
        (context) => {
          const visit = (node) => {
            if (
              ts.isImportDeclaration(node) &&
              ts.isStringLiteral(node.moduleSpecifier)
            ) {
              const replacement = imports[node.moduleSpecifier.text];
              if (replacement) {
                return context.factory.updateImportDeclaration(
                  node,
                  node.modifiers,
                  node.importClause,
                  context.factory.createStringLiteral(replacement),
                  node.attributes,
                );
              }
            }
            return ts.visitEachChild(node, visit, context);
          };
          return (sourceFile) => ts.visitNode(sourceFile, visit);
        },
      ],
    },
  }).outputText;
const compile = (path, imports) =>
  compileSource(readFileSync(join(root, path), "utf8"), imports);
const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

async function main() {
  for (const quote of ["'", '"']) {
    const fixture = compileSource(
      `import {\n value\n} from ${quote}@/fixture${quote}; export { value };`,
      { "@/fixture": moduleUrl("export const value = 42;") },
    );
    assert.equal(
      (await import(moduleUrl(fixture))).value,
      42,
      "Import mapping must support either quote style and multiline imports",
    );
  }
  const storage = new Map();
  global.sessionStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  const identityUrl = moduleUrl(compile("store/utils/commandIdentity.ts"));
  const basePathUrl = moduleUrl(compile("lib/base-path.ts"));
  const { commandIdentity } = await import(identityUrl);
  const a = await commandIdentity("POST", "/example", { b: 2, a: 1 });
  const b = await commandIdentity("POST", "/example", { a: 1, b: 2 });
  assert.equal(a.id, b.id);
  assert.equal(storage.size, 1);
  a.complete();
  assert.notEqual(
    (await commandIdentity("POST", "/example", { a: 1, b: 2 })).id,
    a.id,
  );
  storage.clear();

  const apiSource = compile("store/utils/apiService.ts", {
    "./commandIdentity": identityUrl,
    "@/lib/base-path": basePathUrl,
  });
  const { post, get } = await import(moduleUrl(apiSource));
  const sent = [];
  let fail = true;
  global.fetch = async (_url, options) => {
    sent.push(options);
    if (fail) throw new Error("Simulated lost response");
    return new Response(
      JSON.stringify({ success: true, data: { saved: true } }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  };
  const payload = {
    requestId: "component-local-id-1",
    qtyPick: 2,
    description: "sensitive fixture",
  };
  await assert.rejects(post("/production/shopping", payload));
  assert.equal(sent.length, 1, "Transport must not blindly retry mutations");
  fail = false;
  await post("/production/shopping", {
    ...payload,
    requestId: "component-local-id-after-reload",
  });
  assert.equal(
    JSON.parse(sent[0].body).requestId,
    JSON.parse(sent[1].body).requestId,
    "Reloaded form must reuse the pending command",
  );
  assert.equal(
    storage.size,
    0,
    "Acknowledged command must allow a later new action",
  );
  await post("/production/shopping", payload);
  assert.notEqual(
    JSON.parse(sent[1].body).requestId,
    JSON.parse(sent[2].body).requestId,
  );

  fail = true;
  await assert.rejects(
    post("/master/bom-revisions", {
      reason: "sensitive fixture",
      finishGoodId: 1,
    }),
  );
  const originalKey = sent.at(-1).headers["Idempotency-Key"];
  assert.equal(originalKey.length, 36);
  assert.ok(
    [...storage.entries()].every(
      ([key, value]) => !`${key}${value}`.includes("sensitive fixture"),
    ),
  );
  fail = false;
  await post("/master/bom-revisions", {
    finishGoodId: 1,
    reason: "sensitive fixture",
  });
  assert.equal(sent.at(-1).headers["Idempotency-Key"], originalKey);
  await get("/system-log/actions");
  assert.equal(sent.at(-1).headers["Idempotency-Key"], undefined);
  fail = true;
  await assert.rejects(
    post("/production/forecast/fixture/print-tag", undefined),
  );
  const printKey = sent.at(-1).headers["Idempotency-Key"];
  assert.equal(printKey.length, 36);
  fail = false;
  await post("/production/forecast/fixture/print-tag", undefined);
  assert.equal(sent.at(-1).headers["Idempotency-Key"], printKey);

  const require = createRequire(import.meta.url);
  const toolkitUrl = pathToFileURL(require.resolve("@reduxjs/toolkit")).href;
  const { configureStore } = await import(toolkitUrl);
  const recoverySource = compile(
    "store/features/system-log/integrationThunks.ts",
    {
      "@reduxjs/toolkit": toolkitUrl,
      "@/store/utils/apiService": moduleUrl(apiSource),
      "@/store/utils/commandIdentity": identityUrl,
    },
  );
  const { recoverIntegration } = await import(moduleUrl(recoverySource));
  const store = configureStore({ reducer: (state = {}) => state });
  const recovery = {
    id: "fixture",
    action: "RETRY",
    reason: "Dependency restored",
    expectedAttempts: 5,
  };
  fail = true;
  await assert.rejects(store.dispatch(recoverIntegration(recovery)).unwrap());
  const recoveryKey = JSON.parse(sent.at(-1).body).requestId;
  fail = false;
  await store.dispatch(recoverIntegration(recovery)).unwrap();
  assert.equal(JSON.parse(sent.at(-1).body).requestId, recoveryKey);
  await store
    .dispatch(recoverIntegration({ ...recovery, expectedAttempts: 6 }))
    .unwrap();
  assert.notEqual(JSON.parse(sent.at(-1).body).requestId, recoveryKey);
  console.log(
    "PASS: stable keys, reload recovery, new-action identity, payload minimization, read bypass, and no blind mutation retry.",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
