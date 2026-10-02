/* By Irfan Akbari Vuteq Indonesia - 2026-09-18 */
// Run against a built local web server: node test/assembly-display.mjs
// All API calls are intercepted with synthetic data. No business mutations reach the API.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    const executable =
        process.env.EDGE_EXECUTABLE ||
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    const base = process.env.ASSEMBLY_WEB_TEST_URL || 'http://127.0.0.1:3219';
    assert(
        ['127.0.0.1', 'localhost'].includes(new URL(base).hostname),
        'Use a local test server'
    );
    assert(
        existsSync(executable),
        'Set EDGE_EXECUTABLE to a Chromium-based browser'
    );
    const profile = mkdtempSync(join(tmpdir(), 'ansei-browser-test-'));
    const browser = spawn(
        executable,
        [
            '--headless=new',
            '--disable-gpu',
            '--no-first-run',
            '--remote-debugging-port=0',
            `--user-data-dir=${profile}`,
            'about:blank',
        ],
        { windowsHide: true, stdio: 'ignore' }
    );
    let socket;
    try {
        for (
            let i = 0;
            i < 100 && !existsSync(join(profile, 'DevToolsActivePort'));
            i++
        )
            await delay(100);
        const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8')
            .split('\n')[0]
            .trim();
        const target = await (
            await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
                method: 'PUT',
            })
        ).json();
        socket = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve) =>
            socket.addEventListener('open', resolve, { once: true })
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
            const result = await send('Runtime.evaluate', {
                expression,
                returnByValue: true,
                awaitPromise: true,
            });
            if (result.exceptionDetails)
                throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
            return result.result.value;
        };
        let activeSession = null;
        let starts = 0;
        let completions = 0;
        let operatorActive = true;
        let networkFailure = false;
        let authorized = false;
        let passthrough = false;
        let patches = 0;
        let internalStarts = 0;
        let internalEnds = 0;
        const assemblyQueries = [];
        const operatorRequests = [];
        const errors = [];
        const envelope = (data) => ({ success: true, data });
        socket.addEventListener('message', (event) => {
            const payload = JSON.parse(event.data);
            if (payload.id) {
                const request = pending.get(payload.id);
                if (!request) return;
                pending.delete(payload.id);
                if (payload.error) request.reject(new Error(payload.error.message));
                else request.resolve(payload.result);
                return;
            }
            if (payload.method === 'Runtime.exceptionThrown')
                errors.push(
                    payload.params.exceptionDetails.exception?.description ||
                        payload.params.exceptionDetails.text
                );
            if (
                payload.method === 'Runtime.consoleAPICalled' &&
                payload.params.type === 'error'
            )
                errors.push(
                    payload.params.args
                        .map((a) => a.description || a.value)
                        .join(' ')
                );
            if (payload.method !== 'Fetch.requestPaused') return;
            void (async () => {
                const { requestId, request } = payload.params;
                const url = new URL(request.url);
                let data = envelope(null);
                if (url.pathname === '/api/auth/session')
                    data = authorized
                        ? {
                              user: {
                                  sub: 'TEST-ADMIN',
                                  name: 'Test Admin',
                                  email: 'test@example.invalid',
                              },
                              roles: ['SUPER'],
                              permissions: ['SUPER'],
                              globalRoles: [],
                              expiresAt: new Date(
                                  Date.now() + 3600000
                              ).toISOString(),
                          }
                        : null;
                else if (url.pathname.endsWith('/production/assembly/create-options')) {
                    data = envelope({ labels: [{ LabelNumber: 'READY-BOX', FinishGoodId: 'READY-PART', QtyThisBox: 6, ForecastId: 'PO-READY', ProductionReleaseId: 'PR-READY', PartData: { PartName: 'Ready Part' } }], manpower: [{ Nik: 'IDLE-OP', Name: 'Idle Operator' }] });
                } else if (url.pathname.endsWith('/production/assembly/start')) {
                    const body = JSON.parse(request.postData);
                    assert.equal(body.labelNumber, 'READY-BOX');
                    assert.equal(body.manPowerNik, 'IDLE-OP');
                    assert.match(body.requestId, /^[a-f0-9-]{36}$/);
                    internalStarts++;
                    data = envelope({ Id: 'internal-session' });
                } else if (url.pathname.endsWith('/production/assembly/internal-session/complete')) {
                    const body = JSON.parse(request.postData);
                    assert.equal(body.manPowerNik, undefined);
                    assert.match(body.requestId, /^[a-f0-9-]{36}$/);
                    internalEnds++;
                    data = envelope({ Id: 'internal-session', Status: 'COMPLETED' });
                } else if (url.pathname.endsWith('/production/assembly/sessions')) {
                    assemblyQueries.push(url.searchParams);
                    data = { ...envelope(internalStarts ? [{ Id: 'internal-session', ManPowerUid: 'idle-uid', ManPowerName: 'Idle Operator', Status: internalEnds ? 'COMPLETED' : 'IN_PROGRESS', StartedAt: new Date().toISOString(), EndedAt: internalEnds ? new Date().toISOString() : null, CancelReason: null, LabelData: { LabelNumber: 'READY-BOX', FinishGoodId: 'READY-PART', QtyThisBox: 6, ForecastId: 'PO-READY', ProductionReleaseId: 'PR-READY', PartData: { PartName: 'Ready Part' } } }] : []), meta: { page: 1, limit: 50, totalItems: internalStarts ? 1 : 0, totalPages: 1 } };
                } else if (url.pathname.endsWith('/production/assembly/progress')) {
                    data = envelope({ waitingShopping: 0, ready: 1, inProgress: internalStarts, completed: 0, notRequired: 0 });
                } else if (url.pathname.includes('/master/finish-good')) {
                    if (request.method === 'PATCH') {
                        passthrough = JSON.parse(
                            request.postData
                        ).isPassthrough;
                        patches++;
                    }
                    const row = {
                        Id: 1,
                        PartNumber: 'MASTER-FG',
                        PartName: 'Master Part',
                        Alias: null,
                        Price: 1,
                        IsPassthrough: passthrough,
                        Qty: 0,
                        CreatedAt: new Date().toISOString(),
                        UpdatedAt: new Date().toISOString(),
                        CreatedBy: 'TEST',
                    };
                    data =
                        request.method === 'PATCH'
                            ? envelope(row)
                            : {
                                  ...envelope([row]),
                                  meta: {
                                      page: 1,
                                      limit: 50,
                                      totalItems: 1,
                                      totalPages: 1,
                                  },
                              };
                } else if (url.pathname === '/api/frontend/notifications')
                    data = envelope({
                        totalPOWithoutAttachment: 0,
                        byProductionRelease: [],
                        totalIncomingNotClosed: 0,
                        incomingNotClosed: [],
                        totalStockOpnameInProgress: 0,
                        stockOpnameInProgress: [],
                        totalLabelDataNotScanned: 0,
                        labelDataNotScanned: [],
                        messages: [],
                    });
                else if (url.pathname === '/api/display/manpower')
                    data = envelope([
                        {
                            Nik: 'TEST-OP',
                            Name: 'Saved Operator',
                            PicturePath: null,
                            Line: null,
                            SkillMatrix: [],
                        },
                    ]);
                else if (url.pathname === '/api/display/finish-goods')
                    data = envelope([
                        {
                            PartNumber: 'SAVED-PART',
                            PartName: 'Saved Media Part',
                            Alias: null,
                        },
                    ]);
                else if (url.pathname === '/api/display/assembly/operator') {
                    operatorRequests.push(url.searchParams.get('manPowerNik'));
                    if (networkFailure) {
                        await send('Fetch.failRequest', {
                            requestId,
                            errorReason: 'ConnectionFailed',
                        });
                        return;
                    }
                    data = envelope({
                        active: operatorActive,
                        session: activeSession,
                        serverTime: new Date().toISOString(),
                    });
                } else if (url.pathname === '/api/display/assembly/start') {
                    const body = JSON.parse(request.postData);
                    assert.equal(body.manPowerNik, 'TEST-OP');
                    starts++;
                    activeSession = {
                        Id: '12345678-1234-4234-8234-123456789012',
                        ManPowerUid: 'test-uid',
                        ManPowerName: 'Saved Operator',
                        Status: 'IN_PROGRESS',
                        StartedAt: new Date(
                            Date.now() - 26 * 3600000
                        ).toISOString(),
                        EndedAt: null,
                        LabelData: {
                            LabelNumber: body.labelNumber,
                            FinishGoodId: 'SCANNED-PART',
                            QtyThisBox: 6,
                            ForecastId: 'TEST-PO',
                            ProductionReleaseId: 'TEST-RELEASE',
                            PartData: { PartName: 'Actual Assy Part' },
                        },
                    };
                    data = envelope(activeSession);
                } else if (url.pathname.endsWith('/complete')) {
                    const body = JSON.parse(request.postData);
                    assert.equal(body.manPowerNik, 'TEST-OP');
                    completions++;
                    data = envelope({
                        ...activeSession,
                        Status: 'COMPLETED',
                        EndedAt: new Date().toISOString(),
                    });
                    activeSession = null;
                }
                await send('Fetch.fulfillRequest', {
                    requestId,
                    responseCode: 200,
                    responseHeaders: [
                        { name: 'Content-Type', value: 'application/json' },
                    ],
                    body: Buffer.from(JSON.stringify(data)).toString('base64'),
                });
            })().catch((error) => {
                console.error(error.stack);
                process.exitCode = 1;
            });
        });
        await send('Page.enable');
        await send('Runtime.enable');
        await send('Emulation.setDeviceMetricsOverride', {
            width: 1440,
            height: 1000,
            deviceScaleFactor: 1,
            mobile: false,
        });
        await send('Fetch.enable', {
            patterns: [
                { urlPattern: '*://*/api/*' },
                { urlPattern: 'http://192.168.1.15*' },
            ],
        });
        await send('Page.addScriptToEvaluateOnNewDocument', {
            source: `Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true }); if (!localStorage.getItem('display_config')) localStorage.setItem('display_config', JSON.stringify({ manpower: { Nik: 'TEST-OP', Name: 'Saved Operator', PicturePath: null, Line: null }, finishGood: { PartNumber: 'SAVED-PART', PartName: 'Saved Media Part', Alias: null } }));`,
        });
        const waitFor = async (expression, description) => {
            for (let i = 0; i < 100; i++) {
                if (await evalJs(expression)) return;
                await delay(100);
            }
            throw new Error(
                `Timeout: ${description}; UI=${await evalJs('document.body.innerText.slice(0,1200)')}; URL=${await evalJs('location.pathname')}; operator reads=${operatorRequests.length}; errors=${errors.join(' | ')}`
            );
        };
        const input = `document.querySelector('input[aria-label="Scan assembly label"]')`;
        const clickButton = (text) =>
            evalJs(
                `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(text)})?.click()`
            );
        const scan = async (text) => {
            await evalJs(`${input}.blur()`);
            for (const key of text) await send('Input.dispatchKeyEvent', { type: 'keyDown', key });
            await send('Input.dispatchKeyEvent', {
                type: 'keyDown',
                key: 'Enter',
                code: 'Enter',
                windowsVirtualKeyCode: 13,
            });
            await send('Input.dispatchKeyEvent', {
                type: 'keyUp',
                key: 'Enter',
                code: 'Enter',
                windowsVirtualKeyCode: 13,
            });
        };
        await send('Page.navigate', { url: `${base}/display` });
        await waitFor(`${input} && !${input}.disabled`, 'saved manpower ready');
        assert.equal(operatorRequests[0], 'TEST-OP');
        await scan('BOX-ONE');
        await waitFor("document.body.textContent.includes('Start assembly?')", 'start confirmation');
        assert.equal(starts, 0);
        await clickButton('OK');
        await waitFor(
            `document.body.textContent.includes('Actual Assy Part') && !${input}.disabled`,
            'started session'
        );
        assert.equal(starts, 1);
        assert.equal(completions, 0);
        assert.equal(
            await evalJs(
                `JSON.parse(localStorage.getItem('display_config')).finishGood.PartNumber`
            ),
            'SAVED-PART'
        );
        await clickButton('Config');
        await delay(500);
        assert.equal(
            await evalJs(`Array.from(document.querySelectorAll('[role="dialog"]')).some(e => e.getClientRects().length > 0)`),
            false
        );
        await scan('OTHER-BOX');
        assert.equal(starts, 1);
        assert.equal(completions, 0);
        await send('Page.reload');
        await waitFor(
            `document.body.textContent.includes('Actual Assy Part') && !${input}.disabled`,
            'restore active session'
        );
        await waitFor(
            `document.body.textContent.includes('26:')`,
            'cross-day duration'
        );
        assert.equal(starts, 1);
        await scan('BOX-ONE');
        await waitFor(
            `document.body.textContent.includes('Complete assembly?')`,
            'confirmation'
        );
        assert.equal(completions, 0);
        assert.equal(await evalJs(`${input}.disabled`), true);
        await clickButton('Cancel');
        await waitFor(`!${input}.disabled`, 'cancel confirmation');
        assert.equal(completions, 0);
        await scan('BOX-ONE');
        await waitFor(
            `document.body.textContent.includes('Complete assembly?')`,
            'second confirmation'
        );
        await clickButton('OK');
        await waitFor(
            `!document.body.textContent.includes('Actual Assy Part') && !${input}.disabled`,
            'completed session'
        );
        assert.equal(completions, 1);
        await clickButton('Config');
        await waitFor(
            `document.body.textContent.includes('Display Station Configuration')`,
            'config unlocked'
        );
        assert.equal(await evalJs(`${input}.disabled`), true);
        await clickButton('Batal');
        await waitFor(`!${input}.disabled`, 'config closed');
        networkFailure = true;
        await clickButton('Refresh session');
        await waitFor(
            `${input}.disabled`,
            'connection failure blocks scanning'
        );
        networkFailure = false;
        await clickButton('Refresh session');
        await waitFor(`!${input}.disabled`, 'connection recovery');
        operatorActive = false;
        await clickButton('Refresh session');
        await waitFor(`${input}.disabled`, 'inactive manpower blocked');
        await clickButton('Config');
        await waitFor(
            `document.body.textContent.includes('Display Station Configuration')`,
            'inactive idle manpower can be changed'
        );
        console.log(
            'PASS: Display browser test: legacy saved manpower, scanned part, one active box, refresh, 26h timer, confirmation, config lock, offline recovery, inactive manpower.'
        );
        authorized = true;
        await send('Network.setCookie', {
            name: 'ansei_sso',
            value: 'synthetic-local-test',
            url: base,
        });
        await send('Page.navigate', {
            url: `${base}/apps/master-data/finish-good`,
        });
        await waitFor(
            `document.body.textContent.includes('MASTER-FG')`,
            'master table'
        );
        assert(
            await evalJs(
                `document.body.textContent.includes('Passthrough') && document.body.textContent.includes('Assy required')`
            )
        );
        await evalJs(`document.querySelector('input[type="radio"]').click()`);
        const edit = () =>
            evalJs(
                `Array.from(document.querySelectorAll('span')).find(e => e.textContent === 'Edit')?.click()`
            );
        await edit();
        const activeDialog = `Array.from(document.querySelectorAll('[role="dialog"]')).find(e => e.getClientRects().length > 0)`;
        await waitFor(
            `${activeDialog}?.textContent.includes('Edit Finish Good')`,
            'edit modal'
        );
        const toggle = `${activeDialog}.querySelector('button[role="switch"]')`;
        assert.equal(
            await evalJs(`${toggle}.getAttribute('aria-checked')`),
            'false'
        );
        await evalJs(`${toggle}.click()`);
        await evalJs(
            `Array.from(${activeDialog}.querySelectorAll('button')).find(e => e.textContent.trim() === 'OK').click()`
        );
        await waitFor(
            `document.body.textContent.includes('skip Assy') && !(${activeDialog})`,
            'passthrough saved'
        );
        assert.equal(patches, 1);
        assert.equal(passthrough, true);
        await edit();
        await waitFor(
            `${activeDialog}?.textContent.includes('Edit Finish Good')`,
            'reopen edit modal'
        );
        assert.equal(
            await evalJs(`${toggle}.getAttribute('aria-checked')`),
            'true'
        );
        console.log(
            'PASS: FinishGood browser test: passthrough column, edit switch payload, refresh, reopen preserves saved value.'
        );
        await send('Page.navigate', { url: base + '/apps/production/assembly' });
        await waitFor("document.body.textContent.includes('Create Assembly')", 'assembly toolbar');
        assert(await evalJs("Boolean(document.querySelector('.small-table'))"));
        await evalJs("Array.from(document.querySelectorAll('span')).find(e => e.textContent === 'Create Assembly')?.click()");
        await waitFor("document.querySelector('#labelNumber') && !document.querySelector('.ant-select-loading')", 'ready label options');
        await evalJs("document.querySelector('#labelNumber').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))");
        await waitFor("document.body.textContent.includes('READY-BOX')", 'ready dropdown');
        await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40});
        await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13});
        await evalJs("document.querySelector('#manPowerNik').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))");
        await waitFor("document.body.textContent.includes('Idle Operator')", 'manpower dropdown');
        await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40});
        await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13});
        await clickButton('Start Assembly');
        await waitFor("!document.querySelector('#labelNumber')", 'create modal closed');
        assert.equal(internalStarts, 1);
        assert(assemblyQueries.length >= 2);
        await waitFor("Array.from(document.querySelectorAll('button')).some(e => e.textContent.trim() === 'End Assembly')", 'end action');
        await clickButton('End Assembly');
        await waitFor("Boolean(document.querySelector('[role=dialog]'))", 'end modal');
        await evalJs("Array.from(document.querySelector('[role=dialog]').querySelectorAll('button')).find(e => e.textContent.trim() === 'End Assembly').click()");
        await waitFor("!document.querySelector('#manPowerNik') && !Array.from(document.querySelectorAll('button')).some(e => e.textContent.trim() === 'End Assembly')", 'completed row');
        assert.equal(internalEnds, 1);
        console.log('PASS: Assembly create/end modals, authenticated requests, same manpower, refresh and completed action hidden.');
    } finally {
        if (socket) socket.close();
        browser.kill();
        await delay(1500);
        assert.equal(dirname(resolve(profile)), resolve(tmpdir()));
        assert(basename(profile).startsWith('ansei-browser-test-'));
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
