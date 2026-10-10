/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Compile the real presentation component in memory; no API or browser session.
const require = createRequire(import.meta.url);
const source = readFileSync(
  new URL("../components/SapDocumentNumbers.tsx", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const componentModule = { exports: {} };
new Function("require", "exports", "module", compiled)(
  require,
  componentModule.exports,
  componentModule,
);
const render = (value) =>
  renderToStaticMarkup(
    React.createElement(componentModule.exports.default, { value }),
  );
const document = (number, statuses = ["SYNCED"]) => ({
  key: `internal-${number}`,
  kind: "GOODS_RECEIPT",
  documentNumber: number,
  references: [{ partNumber: "MAT-1", demandId: null }],
  statuses,
});

test("empty state does not imply synced", () => {
  const html = render([]);
  assert.match(html, /—/);
  assert.doesNotMatch(html, /Synced/);
});
test("shows two document numbers and an accessible overflow control", () => {
  const html = render([
    document(101),
    document(102),
    document(103),
    document(104),
  ]);
  assert.match(html, /aria-label="SAP document 101"/);
  assert.match(html, /aria-label="SAP document 102"/);
  assert.doesNotMatch(html, /aria-label="SAP document 103"/);
  assert.match(html, /Show all SAP documents/);
  assert.match(html, /\+2/);
  assert.doesNotMatch(html, /internal-/);
});
test("partial failure preserves document number and reports outstanding statuses", () => {
  const html = render([
    document(101, ["SYNCED", "BLOCKED"]),
    document(null, ["PENDING"]),
  ]);
  assert.match(html, /SAP document 101/);
  assert.match(html, /1 Blocked/);
  assert.match(html, /1 Pending/);
});
test("uncertain and manual mappings show no invented number", () => {
  const html = render([document(null, ["RECONCILE", "UNVERIFIED"])]);
  assert.match(html, /Perlu Rekonsiliasi/);
  assert.match(html, /Belum terverifikasi/);
  assert.doesNotMatch(html, /aria-label="SAP document /);
});
