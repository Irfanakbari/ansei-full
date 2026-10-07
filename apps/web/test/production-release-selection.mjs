/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
// Run against a built local web server: node test/production-release-selection.mjs
// All API calls are intercepted with synthetic data. No business mutations reach the API.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename } from "node:path";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const executable =
    process.env.EDGE_EXECUTABLE ||
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  const base =
    process.env.RELEASE_WEB_TEST_URL || "http://127.0.0.1:3227/ansei";
  assert(
    ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
    "Use a local test server",
  );
  assert(
    existsSync(executable),
    "Set EDGE_EXECUTABLE to a Chromium-based browser",
  );
  const profile = mkdtempSync(join(tmpdir(), "ansei-browser-test-"));
  const browser = spawn(
    executable,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let socket;
  try {
    for (
      let i = 0;
      i < 100 && !existsSync(join(profile, "DevToolsActivePort"));
      i++
    )
      await delay(100);
    const port = readFileSync(join(profile, "DevToolsActivePort"), "utf8")
      .split("\n")[0]
      .trim();
    const target = await (
      await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
        method: "PUT",
      })
    ).json();
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve) =>
      socket.addEventListener("open", resolve, { once: true }),
    );
    const pending = new Map();
    let sequence = 0;
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++sequence;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    const evalJs = async (expression) => {
      const result = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails)
        throw new Error(
          result.exceptionDetails.exception?.description ||
            result.exceptionDetails.text,
        );
      return result.result.value;
    };
    const source =
      process.env.RELEASE_SOURCE_TYPE === "NON_PO" ? "NON_PO" : "PO";
    const prefix = source === "NON_PO" ? "NPO" : "PO";
    const rows = Array.from({ length: 25 }, (_, i) => ({
      PoId: `${prefix}-${String(i + 1).padStart(3, "0")}`,
      FinishGoodId: "FG-TEST",
      Qty: 10,
      DeliveryDate: "2026-10-07",
      DeliveryPeriod: 1,
      ProductionReleaseId: null,
      PartData: { PartNumber: "FG-TEST", PartName: "Test part" },
    }));
    const release = {
      SourceType: source,
      Id: "PR-TEST",
      ReleaseNumber: "PR-TEST",
      Status: "DRAFT",
      PlanDate: "2026-10-07",
      Forecasts: [],
      TotalTargetQty: 250,
      TotalGoodQty: 0,
      TotalNgQty: 0,
      CreatedAt: "2026-10-07",
      UpdatedAt: "2026-10-07",
      CreatedBy: "TEST",
      Notes: null,
      IsNoAttachment: true,
    };
    const submissions = [];
    const nonPoSubmissions = [];
    const snapshots = [];
    let delayIds = false;
    let failIds = false;
    const errors = [];
    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (payload.id) {
        const task = pending.get(payload.id);
        if (!task) return;
        pending.delete(payload.id);
        if (payload.error) task.reject(new Error(payload.error.message));
        else task.resolve(payload.result);
        return;
      }
      if (payload.method === "Runtime.exceptionThrown")
        errors.push(payload.params.exceptionDetails.text);
      if (payload.method !== "Fetch.requestPaused") return;
      void (async () => {
        const { requestId, request } = payload.params;
        const url = new URL(request.url);
        let data = {
          data: [],
          meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
        };
        let status = 200;
        if (url.pathname.endsWith("/auth/session"))
          data = {
            user: { sub: "TEST", name: "Test", email: "test@example.invalid" },
            roles: ["SUPER"],
            permissions: ["SUPER"],
            globalRoles: [],
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          };
        else if (url.pathname.endsWith("/master/finish-good"))
          data = {
            data: [{ Id: 1, PartNumber: "FG-TEST", PartName: "Test part" }],
            meta: { page: 1, limit: 50, totalItems: 1, totalPages: 1 },
          };
        else if (
          url.pathname.endsWith("/forecast-non-po") &&
          request.method === "POST"
        ) {
          nonPoSubmissions.push(JSON.parse(request.postData));
          data = { Id: 1, ReferenceNumber: "NPO-TEST" };
        } else if (url.pathname.includes("candidate")) {
          const matches = rows.filter(
            (row) =>
              !url.searchParams.get("poNumber") ||
              row.PoId.includes(url.searchParams.get("poNumber")),
          );
          if (url.pathname.endsWith("candidate-ids")) {
            snapshots.push(url.search);
            assert(
              !url.searchParams.has("page") && !url.searchParams.has("limit"),
            );
            if (delayIds) await delay(800);
            if (failIds) {
              status = 503;
              data = { message: "Selection unavailable" };
            } else
              data = {
                demandIds: matches.map((row) => row.PoId),
                total: matches.length,
              };
          } else {
            const page = Number(url.searchParams.get("page") || 1),
              limit = Number(url.searchParams.get("limit") || 10);
            data = {
              data: matches.slice((page - 1) * limit, page * limit),
              meta: {
                page,
                limit,
                totalItems: matches.length,
                totalPages: Math.ceil(matches.length / limit),
              },
            };
          }
        } else if (
          url.pathname.endsWith("/forecasts/tag") ||
          url.pathname.endsWith("/forecasts/untag") ||
          (url.pathname.endsWith("/production-release") &&
            request.method === "POST")
        ) {
          submissions.push(JSON.parse(request.postData));
          data = release;
        } else if (url.pathname.endsWith("/production-release"))
          data = {
            data: [release],
            meta: { page: 1, limit: 50, totalItems: 1, totalPages: 1 },
          };
        await send("Fetch.fulfillRequest", {
          requestId,
          responseCode: status,
          responseHeaders: [
            { name: "Content-Type", value: "application/json" },
          ],
          body: Buffer.from(JSON.stringify(data)).toString("base64"),
        });
      })().catch((error) => {
        errors.push(error.message);
      });
    });
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Network.setCookie", {
      name: "ansei_sso",
      value: "mock-test-only",
      url: base,
    });
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Fetch.enable", {
      patterns: [
        { urlPattern: "*://*/api/*" },
        { urlPattern: "*://*/ansei/api/*" },
      ],
    });
    const waitFor = async (expression, label) => {
      for (let i = 0; i < 300; i++) {
        if (await evalJs(`Boolean(${expression})`)) return;
        await delay(100);
      }
      throw new Error(
        `Timeout ${label}: ${await evalJs("document.body.innerText.slice(-2200)")}; errors=${errors.join("|")}`,
      );
    };
    const dialog = `Array.from(document.querySelectorAll('[role=dialog]')).find(e => e.getClientRects().length)`;
    const click = (text) =>
      evalJs(
        `Array.from(document.querySelectorAll('button, span')).find(b => b.getClientRects().length && b.textContent.trim() === ${JSON.stringify(text)})?.click()`,
      );
    const count = (n) =>
      waitFor(
        `${dialog}?.textContent.includes('${n} selected')`,
        `${n} selected`,
      );
    const page = async (n) => {
      await evalJs(
        `${dialog}.querySelector('.ant-pagination-item-${n}').click()`,
      );
      await waitFor(
        `${dialog}.querySelector('tr[data-row-key="${prefix}-${String((n - 1) * 10 + 1).padStart(3, "0")}"] input') && !${dialog}.querySelector('tr[data-row-key="${prefix}-${String((n - 1) * 10 + 1).padStart(3, "0")}"] input').disabled`,
        `page ${n}`,
      );
    };
    const filter = async (value) => {
      await evalJs(
        `${dialog}.querySelector('.ant-table-filter-trigger').click()`,
      );
      await waitFor(
        `document.querySelector('input[aria-label="Filter Order Reference"]')`,
        "filter popup",
      );
      await evalJs(
        `document.querySelector('input[aria-label="Filter Order Reference"]').focus()`,
      );
      await send("Input.insertText", { text: value });
      await click("Search");
      await delay(200);
    };
    await send("Page.navigate", {
      url: base + "/apps/production/production-release",
    });
    await waitFor(
      `Array.from(document.querySelectorAll('button, span')).some(b => b.textContent.trim() === 'Create')`,
      "release toolbar",
    );
    for (const kind of ["Create", "Manage Forecasts"]) {
      console.log("Testing", kind);
      if (kind === "Manage Forecasts")
        await evalJs(
          `document.querySelector('tr[data-row-key="PR-TEST"]').click()`,
        );
      await click(kind);
      if (kind === "Create" && source === "NON_PO")
        await evalJs(
          `${dialog}.querySelectorAll('.ant-segmented-item')[1].click()`,
        );
      await waitFor(
        `${dialog}?.textContent.includes('Select all matching orders (25)')`,
        kind,
      );
      await click("Select all matching orders (25)");
      await count(25);
      await evalJs(
        `${dialog}.querySelectorAll('.ant-segmented-item')[${kind === "Manage Forecasts" || source === "PO" ? 1 : 0}].click()`,
      );
      await count(0);
      await evalJs(
        `${dialog}.querySelectorAll('.ant-segmented-item')[${kind === "Manage Forecasts" || source === "PO" ? 0 : 1}].click()`,
      );
      await count(0);
      await waitFor(
        `${dialog}.querySelector('thead input[type=checkbox]') && !${dialog}.querySelector('thead input[type=checkbox]').disabled`,
        "picker after mode reset",
      );
      await evalJs(
        `${dialog}.querySelector('thead input[type=checkbox]').click()`,
      );
      await count(10);
      await page(2);
      await count(10);
      await evalJs(
        `${dialog}.querySelector('tr[data-row-key] input[type=checkbox]').click()`,
      );
      await count(11);
      await page(3);
      await count(11);
      await click("Select all matching orders (25)");
      await count(25);
      await evalJs(
        `${dialog}.querySelector('tr[data-row-key] input[type=checkbox]').click()`,
      );
      await count(24);
      await page(1);
      await count(24);
      await evalJs(
        `${dialog}.querySelector('.ant-pagination-options input[role=combobox]').focus()`,
      );
      await send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "ArrowDown",
        code: "ArrowDown",
        windowsVirtualKeyCode: 40,
      });
      await send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "ArrowDown",
        code: "ArrowDown",
        windowsVirtualKeyCode: 40,
      });
      await waitFor(
        `Array.from(document.querySelectorAll('.ant-select-item-option')).some(e => e.getClientRects().length && e.textContent.includes('20 / page'))`,
        "page size options",
      );
      await evalJs(
        `Array.from(document.querySelectorAll('.ant-select-item-option')).find(e => e.getClientRects().length && e.textContent.includes('20 / page')).click()`,
      );
      await count(24);
      await waitFor(
        `${dialog}.querySelectorAll('tr[data-row-key]').length === 20`,
        "twenty rows",
      );
      assert.equal(
        await evalJs(
          `${dialog}.querySelectorAll('tr[data-row-key] input[type=checkbox]:checked').length`,
        ),
        20,
      );
      if (kind === "Create") {
        await evalJs(`${dialog}.querySelector('#planDate').click()`);
        await waitFor(
          `document.querySelector('.ant-picker-now-btn')`,
          "date picker",
        );
        await evalJs(`document.querySelector('.ant-picker-now-btn').click()`);
        await click("OK");
        await waitFor(`!${dialog}`, "create submit");
        assert.equal(submissions.at(-1).demandIds.length, 24);
        assert.equal(submissions.at(-1).sourceType, source);
        assert(!submissions.at(-1).demandIds.includes(`${prefix}-021`));
        await click("Create");
        await waitFor(
          `${dialog}?.textContent.includes('Select all matching orders (25)')`,
          "create reopened",
        );
        await count(0);
      }
      await click("Clear selection");
      await count(0);
      failIds = true;
      await click("Select all matching orders (25)");
      await waitFor(
        `document.body.textContent.includes('Selection unavailable')`,
        "selection error",
      );
      await count(0);
      failIds = false;
      delayIds = true;
      await click("Select all matching orders (25)");
      await filter(`${prefix}-001`);
      await delay(1100);
      await count(0);
      delayIds = false;
      await waitFor(
        `${dialog}?.textContent.includes('Select all matching orders (1)')`,
        "filtered total",
      );
      await click("Select all matching orders (1)");
      await count(1);
      if (kind === "Manage Forecasts") {
        await evalJs(`document.querySelector('#reason').focus()`);
        await send("Input.insertText", { text: "Test selection" });
        await click("OK");
        await waitFor(`!${dialog}`, "submit close");
        assert.deepEqual(submissions.at(-1).demandIds, [`${prefix}-001`]);
      } else {
        await click("Cancel");
        await click("Create");
        await waitFor(
          `${dialog}?.textContent.includes('Select all matching orders (25)')`,
          "reopen",
        );
        await count(0);
        await click("Cancel");
      }
    }
    await send("Page.navigate", {
      url: base + "/apps/production/forecast-non-po",
    });
    await waitFor(
      `Array.from(document.querySelectorAll('button')).some(b => b.getClientRects().length && b.textContent.trim() === 'Import Excel')`,
      "non PO toolbar",
    );
    await click("Create");
    await waitFor(`${dialog}?.querySelector('#partNumber')`, "non PO form");
    await evalJs(`${dialog}.querySelector('#partNumber').focus()`);
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "ArrowDown",
      code: "ArrowDown",
      windowsVirtualKeyCode: 40,
    });
    await waitFor(
      `Array.from(document.querySelectorAll('.ant-select-item-option')).some(e => e.getClientRects().length && e.textContent.includes('FG-TEST'))`,
      "part option",
    );
    await evalJs(
      `Array.from(document.querySelectorAll('.ant-select-item-option')).find(e => e.getClientRects().length && e.textContent.includes('FG-TEST')).click()`,
    );
    await evalJs(`${dialog}.querySelector('#deliveryDate').click()`);
    await waitFor(
      `document.querySelector('.ant-picker-now-btn')`,
      "delivery date picker",
    );
    await evalJs(`document.querySelector('.ant-picker-now-btn').click()`);
    for (const [field, value] of [
      ["receivingArea", "AREA-TEST"],
      ["deliveryPeriod", "1"],
      ["qty", "7"],
    ]) {
      await evalJs(`${dialog}.querySelector('#${field}').focus()`);
      await send("Input.insertText", { text: value });
    }
    await click("Save");
    await waitFor(`!${dialog}`, "non PO create");
    assert.equal(nonPoSubmissions.length, 1);
    assert.equal(nonPoSubmissions[0].partNumber, "FG-TEST");
    assert.equal(nonPoSubmissions[0].qty, 7);
    assert.equal(nonPoSubmissions[0].poNumber, null);
    assert.equal(nonPoSubmissions[0].notes, null);
    assert(nonPoSubmissions[0].requestId);
    assert(snapshots.length >= 8);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: both modals preserve selection across three pages, select all 25 IDs, deselect, clear, reset filters/reopen, ignore stale snapshots, handle failures, and submit filtered IDs.",
    );
  } finally {
    if (socket) socket.close();
    browser.kill();
    await delay(1500);
    assert.equal(dirname(resolve(profile)), resolve(tmpdir()));
    assert(basename(profile).startsWith("ansei-browser-test-"));
    rmSync(profile, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
  }
}
main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
