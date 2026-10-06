/* By Irfan Akbari Vuteq Indonesia - 2026-10-06 */
// Build API/web, start web locally, then: node test/production-dashboard.mjs
// Uses the real dashboard mapper with synthetic records. No business API is called.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import {
    mkdtempSync,
    readFileSync,
    existsSync,
    rmSync,
    mkdirSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename } from "node:path";

const require = createRequire(import.meta.url);
const {
    buildDashboardRelease,
    emptyDashboardMetrics,
} = require("../../api/dist/src/frontend/production-dashboard.service.js");
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
const now = new Date();
const stamp = (hoursAgo) => new Date(now.getTime() - hoursAgo * 3600000);
function fixture() {
    const outputs = [];
    const releases = ["A", "B"].map((key, releaseIndex) => {
        const source = {
            Id: key,
            ReleaseNumber: `PR-DEMO-2026-${key}`,
            PlanDate: now,
            ProductionFindings: [
                { Status: "PENDING" },
                { Status: "WAITING_PART_CHANGE" },
            ],
            Forecasts: [1, 2, 4, 6].flatMap((period, index) =>
                [0, 1].map((part) => {
                    const po = `PO-DEMO-${key}-${period}${part}`;
                    const qty = 240 + part * 120;
                    const perBox = qty / 4;
                    const shipped =
                        index === 0 ? 4 : index === 1 ? part + 1 : 0;
                    const assembled = index < 2 ? 4 : index === 2 ? 3 : 1;
                    const labels = [0, 1, 2, 3].map((box) => {
                        const done = box < assembled;
                        if (done)
                            outputs.push({
                                ReferenceDoc: `ASSY-${po}-${box}`,
                                FinishGoodId: `FG-${part}`,
                                QtyIn: perBox,
                                TransactionDate: stamp(index + 1),
                            });
                        return {
                            LabelNumber: `${po}-${box}`,
                            QtyThisBox: perBox,
                            Scanned: done,
                            RequiresAssembly: true,
                            AssemblySessions:
                                done || box === assembled
                                    ? [
                                          {
                                              Id: `${po}-${box}`,
                                              Status: done
                                                  ? "COMPLETED"
                                                  : "IN_PROGRESS",
                                          },
                                      ]
                                    : [],
                        };
                    });
                    return {
                        PoId: po,
                        Qty: qty,
                        FinishGoodId: `FG-${part}`,
                        DeliveryPeriod: period,
                        DeliveryDate:
                            part === 1 && index === 1 ? stamp(30) : now,
                        PartData: {
                            PartName: part
                                ? "Door Handle Assembly RH"
                                : "Door Handle Assembly LH",
                        },
                        BomSnapshots: [
                            {
                                ReleaseId: key,
                                TargetQty: qty,
                                Lines: [
                                    {
                                        Id: po,
                                        RequiredQty: qty,
                                        Material: { PartNumber: "MAT-1" },
                                    },
                                ],
                            },
                        ],
                        Shopping: [
                            {
                                Id: po,
                                MaterialId: "MAT-1",
                                QtyPick: index < 3 ? qty : qty / 2,
                            },
                        ],
                        LabelData: labels,
                        DeliveryHistory: labels
                            .slice(0, shipped)
                            .map((label) => ({
                                ForecastId: po,
                                LabelDataId: label.LabelNumber,
                                Qty: perBox,
                                CreatedAt: stamp(releaseIndex + 0.5),
                            })),
                    };
                }),
            ),
        };
        return buildDashboardRelease(source, outputs, now);
    });
    const metrics = emptyDashboardMetrics();
    for (const release of releases)
        for (const key of Object.keys(metrics))
            metrics[key] += release.metrics[key];
    const hourly = releases[0].hourly.map((hour, i) => ({
        hour: hour.hour,
        producedQty: hour.producedQty + releases[1].hourly[i].producedQty,
        deliveredQty: hour.deliveredQty + releases[1].hourly[i].deliveredQty,
    }));
    return {
        generatedAt: now.toISOString(),
        timezone: "Asia/Jakarta",
        refreshSeconds: 20,
        inventoryHolds: [],
        metrics,
        releases,
        hourly,
    };
}

async function main() {
    const base =
        process.env.DASHBOARD_WEB_TEST_URL || "http://127.0.0.1:3221/ansei";
    assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
    const executable =
        process.env.EDGE_EXECUTABLE ||
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
    assert(existsSync(executable), "Set EDGE_EXECUTABLE to a Chromium browser");
    const profile = mkdtempSync(join(tmpdir(), "ansei-dashboard-test-"));
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
            let n = 0;
            n < 100 && !existsSync(join(profile, "DevToolsActivePort"));
            n++
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
        await new Promise((done) =>
            socket.addEventListener("open", done, { once: true }),
        );
        let sequence = 0;
        const pending = new Map();
        const errors = [];
        let mode = "normal";
        let requests = 0;
        const normal = fixture();
        const send = (method, params = {}) =>
            new Promise((resolve, reject) => {
                const id = ++sequence;
                pending.set(id, { resolve, reject });
                socket.send(JSON.stringify({ id, method, params }));
            });
        socket.addEventListener("message", (event) => {
            const message = JSON.parse(event.data);
            if (message.id) {
                const call = pending.get(message.id);
                pending.delete(message.id);
                if (message.error)
                    call?.reject(new Error(message.error.message));
                else call?.resolve(message.result);
                return;
            }
            if (message.method === "Runtime.exceptionThrown")
                errors.push(
                    message.params.exceptionDetails.exception?.description ||
                        message.params.exceptionDetails.text,
                );
            if (message.method !== "Fetch.requestPaused") return;
            void (async () => {
                const { request, requestId } = message.params;
                const path = new URL(request.url).pathname;
                assert.equal(request.method, "GET", "Dashboard must only read");
                let body = null;
                let responseCode = 200;
                if (path.endsWith("/api/dashboard")) {
                    requests++;
                    if (mode === "failure") {
                        responseCode = 503;
                        body = { message: "Synthetic outage" };
                    } else if (mode === "empty")
                        body = {
                            success: true,
                            data: {
                                ...normal,
                                releases: [],
                                metrics: emptyDashboardMetrics(),
                            },
                        };
                    else
                        body = {
                            success: true,
                            data: {
                                ...normal,
                                inventoryHolds:
                                    mode === "hold" ? ["FINISH_GOOD"] : [],
                                generatedAt:
                                    mode === "old"
                                        ? new Date(
                                              Date.now() - 90000,
                                          ).toISOString()
                                        : new Date().toISOString(),
                            },
                        };
                } else
                    assert(
                        path.endsWith("/api/auth/session"),
                        `Unexpected API request: ${path}`,
                    );
                await send("Fetch.fulfillRequest", {
                    requestId,
                    responseCode,
                    responseHeaders: [
                        { name: "Content-Type", value: "application/json" },
                    ],
                    body: Buffer.from(JSON.stringify(body)).toString("base64"),
                });
            })().catch((error) => errors.push(error.stack));
        });
        const evaluate = async (expression) => {
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
        const waitFor = async (expression, name) => {
            for (let n = 0; n < 300; n++) {
                if (await evaluate(expression)) return;
                await delay(100);
            }
            throw new Error(`Timed out: ${name}`);
        };
        const click = (label) =>
            evaluate(
                `document.querySelector('button[aria-label="${label}"]').click()`,
            );
        const refresh = async () => {
            await waitFor(
                `!document.querySelector('button[aria-label="Refresh production data"]').disabled`,
                "refresh enabled",
            );
            const previous = requests;
            await click("Refresh production data");
            await waitFor(
                `!document.querySelector('button[aria-label="Refresh production data"]').disabled`,
                "refresh finished",
            );
            assert(requests > previous);
        };
        await send("Runtime.enable");
        await send("Page.enable");
        await send("Fetch.enable", { patterns: [{ urlPattern: "*/api/*" }] });
        await send("Emulation.setDeviceMetricsOverride", {
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await send("Page.navigate", { url: `${base}/dashboard` });
        await waitFor(
            'document.body.textContent.includes("PO Fully Delivered")',
            "public dashboard loaded",
        );
        await waitFor(
            '!document.body.textContent.includes("--:--:--")',
            "live clock",
        );
        assert.equal(
            await evaluate(
                "document.querySelectorAll('svg[data-process]').length",
            ),
            4,
            "Every process has an illustration",
        );
        assert(
            await evaluate(
                "document.body.textContent.includes('Inspection') && !document.body.textContent.includes('Poka-Yoke')",
            ),
            "Inspection terminology",
        );
        const animatedParts = `[...document.querySelectorAll('svg[data-process] *')].filter(e => getComputedStyle(e).animationName !== 'none')`;
        assert(
            await evaluate(
                `${animatedParts}.some(e => getComputedStyle(e).animationPlayState === 'running')`,
            ),
            "Decorative process motion runs",
        );
        await click("Pause automatic motion");
        assert(
            await evaluate(
                `${animatedParts}.every(e => getComputedStyle(e).animationPlayState === 'paused')`,
            ),
            "Pause also stops the process illustrations",
        );
        await send("Emulation.setEmulatedMedia", {
            features: [{ name: "prefers-reduced-motion", value: "reduce" }],
        });
        assert.equal(
            await evaluate(`${animatedParts}.length`),
            0,
            "Reduced motion disables decorative animation",
        );
        await send("Emulation.setEmulatedMedia", {
            features: [
                { name: "prefers-reduced-motion", value: "no-preference" },
            ],
        });
        assert.equal(
            await evaluate("location.pathname"),
            new URL(base).pathname + "/dashboard",
        );
        assert(
            await evaluate(
                `document.querySelector('[aria-label="Production summary"]').textContent.includes('${normal.metrics.deliveredQty.toLocaleString("en-US")}')`,
            ),
        );
        const outputDir = resolve("../../.codex-build/dashboard");
        mkdirSync(outputDir, { recursive: true });
        for (const theme of ["light", "dark"]) {
            await send("Emulation.setEmulatedMedia", {
                features: [{ name: "prefers-color-scheme", value: theme }],
            });
            for (const [width, height] of [
                [1920, 1080],
                [1366, 768],
            ]) {
                await send("Emulation.setDeviceMetricsOverride", {
                    width,
                    height,
                    deviceScaleFactor: 1,
                    mobile: false,
                });
                await delay(350);
                const bounds = await evaluate(
                    `({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, innerWidth, innerHeight, clippedPanels: [...document.querySelectorAll('article')].filter(e => e.scrollHeight > e.clientHeight + 2).map(e => e.querySelector('h2')?.textContent || e.querySelector('p')?.textContent) })`,
                );
                assert.equal(
                    bounds.width,
                    width,
                    "No horizontal page scrolling",
                );
                assert.equal(
                    bounds.height,
                    height,
                    "All dashboard content fits one screen",
                );
                const shot = await send("Page.captureScreenshot", {
                    format: "png",
                });
                writeFileSync(
                    join(
                        outputDir,
                        `dashboard-${theme}-${width}x${height}.png`,
                    ),
                    Buffer.from(shot.data, "base64"),
                );
                assert.deepEqual(
                    bounds.clippedPanels,
                    [],
                    `No clipped panels at ${width}x${height}`,
                );
                assert(
                    await evaluate(`(() => {
                        const fullscreen = document.querySelector('button[aria-label="Toggle fullscreen"]');
                        const clock = fullscreen.nextElementSibling;
                        return clock === fullscreen.parentElement.lastElementChild
                            && clock.getBoundingClientRect().left >= fullscreen.getBoundingClientRect().right;
                    })()`),
                    "Clock is at the far right after all controls",
                );
                assert.deepEqual(
                    await evaluate(
                        `[...document.querySelectorAll('[class*="_orderRow"], [class*="_cycleRow"]')].filter(e => e.scrollHeight > e.clientHeight + 2).map(e => ({ height: e.clientHeight, content: e.scrollHeight, width: innerWidth, lineHeight: getComputedStyle(e).lineHeight, childHeight: e.firstElementChild.getBoundingClientRect().height, childLineHeight: getComputedStyle(e.firstElementChild).lineHeight }))`,
                    ),
                    [],
                    "No overlapping PO or cycle rows",
                );
                const appearance = await evaluate(`(() => {
                const board = getComputedStyle(document.querySelector('main'));
                return { scheme: board.colorScheme, background: board.backgroundColor,
                    kpiSize: parseFloat(getComputedStyle(document.querySelector('[class*="_kpiValue"]')).fontSize),
                    poSize: parseFloat(getComputedStyle(document.querySelector('[class*="_orderIdentity"] strong')).fontSize),
                    colors: Object.fromEntries(['text','muted','panel','teal','blue','amber','red','warning-bg'].map(k => [k,board.getPropertyValue('--'+k).trim()])) };
            })()`);
                assert.equal(
                    appearance.scheme,
                    theme,
                    "Theme follows the system without reloading",
                );
                assert(
                    appearance.kpiSize >= 34 && appearance.kpiSize <= 48,
                    "Primary figures remain readable and proportionate",
                );
                assert(
                    appearance.poSize >= 15,
                    "PO identifiers remain readable",
                );
                const luminance = (hex) => {
                    const raw = hex.slice(1);
                    const normalized =
                        raw.length === 3
                            ? [...raw].map((v) => v + v).join("")
                            : raw;
                    const rgb = normalized
                        .match(/../g)
                        .map((v) => parseInt(v, 16) / 255)
                        .map((v) =>
                            v <= 0.04045
                                ? v / 12.92
                                : ((v + 0.055) / 1.055) ** 2.4,
                        );
                    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
                };
                const contrast = (a, b) =>
                    (Math.max(luminance(a), luminance(b)) + 0.05) /
                    (Math.min(luminance(a), luminance(b)) + 0.05);
                for (const key of [
                    "text",
                    "muted",
                    "teal",
                    "blue",
                    "amber",
                    "red",
                ])
                    assert(
                        contrast(
                            appearance.colors[key],
                            appearance.colors.panel,
                        ) >= 4.5,
                        `${theme} ${key} text contrast`,
                    );
                assert(
                    contrast(
                        appearance.colors.amber,
                        appearance.colors["warning-bg"],
                    ) >= 4.5,
                    `${theme} warning contrast`,
                );
            }
        }
        await click("Next cycle page");
        assert(await evaluate('document.body.textContent.includes("2 / 3")'));
        assert(
            await evaluate(
                `!document.querySelector('button[aria-label="Next PO page"]')`,
            ),
            "PO pagination is replaced by scrolling",
        );
        await evaluate(
            `(() => { const select = document.querySelector('select[aria-label="Production release"]'); select.value = 'B'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`,
        );
        await waitFor(
            'document.querySelector("select").value === "B"',
            "release filter",
        );
        assert.equal(
            await evaluate(
                `document.querySelector('[aria-label="PO progress, scroll to view all orders"]').scrollTop`,
            ),
            0,
            "Changing release resets the scroll position",
        );
        assert(
            !(await evaluate(
                `document.querySelector('main').textContent.includes('PO-DEMO-A-')`,
            )),
        );
        mode = "failure";
        await refresh();
        await waitFor(
            'document.body.textContent.includes("Data Delayed")',
            "stale connection banner",
        );
        assert(
            await evaluate(
                'document.body.textContent.includes("PO Fully Delivered")',
            ),
            "Preserve last good data",
        );
        mode = "hold";
        await refresh();
        await waitFor(
            'document.body.textContent.includes("Inventory Count Active") && !document.body.textContent.includes("Data Delayed")',
            "recovery and inventory hold",
        );
        mode = "old";
        await refresh();
        await waitFor(
            'document.body.textContent.includes("Data Delayed")',
            "old data timestamp warning",
        );
        mode = "empty";
        await refresh();
        await waitFor(
            'document.body.textContent.includes("No Active Production Release")',
            "empty state",
        );
        assert.equal(
            await evaluate('document.querySelector("select").value'),
            "all",
        );
        mode = "failure";
        await send("Page.reload", { ignoreCache: true });
        await waitFor(
            'document.body.textContent.includes("Production Data Unavailable")',
            "initial error state",
        );
        mode = "normal";
        await evaluate(
            `Array.from(document.querySelectorAll('button')).find(e => e.textContent === 'Retry Now').click()`,
        );
        await waitFor(
            'document.body.textContent.includes("PO Fully Delivered")',
            "retry recovery",
        );
        const previous = requests;
        await waitFor(
            "document.querySelector('[aria-label=\"PO progress, scroll to view all orders\"]').scrollTop > 20",
            "automatic PO scrolling",
        );
        const poViewport = `document.querySelector('[aria-label="PO progress, scroll to view all orders"]')`;
        const scrollStart = await evaluate(`${poViewport}.scrollTop`);
        await delay(1000);
        const distance =
            (await evaluate(`${poViewport}.scrollTop`)) - scrollStart;
        assert(
            distance >= 8 && distance <= 22,
            "PO list scrolls slowly at about 14 px/s",
        );
        await click("Pause automatic motion");
        const pausedAt = await evaluate(`${poViewport}.scrollTop`);
        await delay(500);
        assert.equal(
            await evaluate(`${poViewport}.scrollTop`),
            pausedAt,
            "Pause stops PO scrolling",
        );
        await send("Emulation.setEmulatedMedia", {
            features: [{ name: "prefers-reduced-motion", value: "reduce" }],
        });
        await click("Resume automatic motion");
        await delay(3500);
        assert.equal(
            await evaluate(`${poViewport}.scrollTop`),
            pausedAt,
            "Reduced motion stops PO scrolling",
        );
        await send("Emulation.setEmulatedMedia", {
            features: [
                { name: "prefers-reduced-motion", value: "no-preference" },
            ],
        });
        await evaluate(`${poViewport}.focus()`);
        await delay(3500);
        assert.equal(
            await evaluate(`${poViewport}.scrollTop`),
            pausedAt,
            "Keyboard focus pauses the PO list",
        );
        await evaluate(
            `${poViewport}.blur(); ${poViewport}.scrollTop = ${poViewport}.scrollHeight`,
        );
        await waitFor(
            `${poViewport}.scrollTop < 10`,
            "PO scroll loops after reaching the bottom",
        );
        // Allow at most one normal polling interval.
        for (let n = 0; n < 210 && requests === previous; n++) await delay(100);
        assert(requests > previous, "Automatic refresh fetches fresh data");
        assert.deepEqual(errors, []);
        console.log(
            "PASS: public access, actual mapper fixture, 1920x1080 + 1366x768 one-screen layout, release filter, cycle paging, slow PO scrolling, pause, reduced motion, focus and loop, automatic refresh, stale data, recovery, inventory hold, empty/error states. No API mutations.",
        );
        console.log(`Screenshots: ${outputDir}`);
    } finally {
        socket?.close();
        browser.kill();
        await delay(1500);
        assert.equal(dirname(resolve(profile)), resolve(tmpdir()));
        assert(basename(profile).startsWith("ansei-dashboard-test-"));
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
