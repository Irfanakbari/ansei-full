/* By Irfan Akbari Vuteq Indonesia - 2026-09-18 */
"use client";
import {createAssemblyRequestId} from "@/store/features/production/assembly/requestId";
import {useCallback, useEffect, useRef, useState} from "react";
import {Alert, App, Button, Input, Modal, Tag} from "antd";
import type {InputRef} from "antd";
import {useDispatch} from "react-redux";
import type {AppDispatch} from "@/store";
import {
    completeAssembly,
    fetchOperatorAssembly,
    startAssembly,
    type AssemblySession,
} from "@/store/features/production/assembly/assemblySlice";

export default function AssemblyScanPanel({
                                              nik,
                                              paused,
                                              onLocked,
                                              getContainer,
                                          }: {
    nik: string | null;
    paused: boolean;
    onLocked: (locked: boolean) => void;
    getContainer: () => HTMLElement;
}) {
    const dispatch = useDispatch<AppDispatch>();
    const {message} = App.useApp();
    const [session, setSession] = useState<AssemblySession | null>(null);
    const [label, setLabel] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    const [verified, setVerified] = useState(false);
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const [pendingStart, setPendingStart] = useState<string | null>(null);
    const keyboardBuffer = useRef("");
    const startRequest = useRef<{
        labelNumber: string;
        requestId: string;
    } | null>(null);
    const [now, setNow] = useState(0);
    const offset = useRef(0);
    const input = useRef<InputRef>(null);
    const inFlight = useRef(false);
    const requestVersion = useRef(0);
    const currentNik = useRef(nik);
    const completionRequest = useRef<{ id: string; requestId: string } | null>(
        null,
    );
    const refresh = useCallback(async () => {
        if (!nik) return;
        const version = ++requestVersion.current;
        try {
            const result = await dispatch(fetchOperatorAssembly(nik)).unwrap();
            if (currentNik.current !== nik || version !== requestVersion.current)
                return;
            offset.current = Date.parse(result.serverTime) - Date.now();
            setVerified(true);
            setSession(result.session);
            setReady(result.active);
            setError(
                result.active
                    ? null
                    : "Manpower is inactive. Ask the leader to cancel any active session before changing manpower.",
            );
        } catch (err) {
            if (currentNik.current === nik && version === requestVersion.current) {
                setVerified(false);
                setReady(false);
                setError(String(err));
            }
        }
    }, [dispatch, nik]);
    useEffect(() => {
        currentNik.current = nik;
        setSession(null);
        setVerified(false);
        setReady(false);
        setConfirm(false);
        setPendingStart(null);
        keyboardBuffer.current = "";
        setLabel("");
        void refresh();
        const timer = setInterval(() => {
            if (!inFlight.current) void refresh();
        }, 15000);
        const focus = () => {
            if (!inFlight.current) void refresh();
        };
        const offline = () => {
            setVerified(false);
            setReady(false);
            setError("Offline. Reconnect and refresh before scanning.");
        };
        window.addEventListener("focus", focus);
        window.addEventListener("online", focus);
        window.addEventListener("offline", offline);
        return () => {
            clearInterval(timer);
            window.removeEventListener("focus", focus);
            window.removeEventListener("online", focus);
            window.removeEventListener("offline", offline);
        };
    }, [nik, refresh]);
    useEffect(() => {
        onLocked(Boolean(nik && (!verified || session || busy || pendingStart)));
    }, [nik, verified, session, busy, pendingStart, onLocked]);
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now() + offset.current), 1000);
        return () => clearInterval(timer);
    }, []);
    useEffect(() => {
        if (!paused && !confirm && !pendingStart && ready && !busy)
            input.current?.focus();
    }, [paused, confirm, pendingStart, ready, busy]);
    const scan = async (value = label) => {
        const scanned = value.trim();
        if (
            !nik ||
            !scanned ||
            !ready ||
            paused ||
            confirm ||
            pendingStart ||
            inFlight.current ||
            !navigator.onLine
        )
            return;
        setLabel("");
        keyboardBuffer.current = "";
        if (session) {
            if (session.LabelData.LabelNumber !== scanned) {
                message.error("Finish the active box before scanning another label.");
                return;
            }
            setConfirm(true);
            return;
        }
        setPendingStart(scanned);
    };
    const begin = async () => {
        if (
            !pendingStart ||
            !nik ||
            !ready ||
            paused ||
            inFlight.current ||
            !navigator.onLine
        )
            return;
        const scanned = pendingStart;
        requestVersion.current++;
        inFlight.current = true;
        setBusy(true);
        if (startRequest.current?.labelNumber !== scanned)
            startRequest.current = {
                labelNumber: scanned,
                requestId: createAssemblyRequestId(),
            };
        try {
            const result = await dispatch(
                startAssembly({
                    labelNumber: scanned,
                    manPowerNik: nik,
                    requestId: startRequest.current.requestId,
                }),
            ).unwrap();
            if (currentNik.current === nik) {
                setSession(result);
                setPendingStart(null);
                startRequest.current = null;
                message.success("Assembly started");
            }
        } catch (err) {
            message.error(String(err));
        } finally {
            await refresh();
            inFlight.current = false;
            setBusy(false);
        }
    };
    const finish = async () => {
        if (!session || !nik || !ready || inFlight.current || !navigator.onLine)
            return;
        requestVersion.current++;
        inFlight.current = true;
        setBusy(true);
        if (completionRequest.current?.id !== session.Id)
            completionRequest.current = {
                id: session.Id,
                requestId: createAssemblyRequestId(),
            };
        try {
            await dispatch(
                completeAssembly({
                    ...completionRequest.current,
                    manPowerNik: nik,
                }),
            ).unwrap();
            setConfirm(false);
            setSession(null);
            message.success("Assembly completed. Box is ready for Poka-Yoke.");
        } catch (err) {
            message.error(String(err));
        } finally {
            await refresh();
            inFlight.current = false;
            setBusy(false);
        }
    };
    const scanHandler = useRef(scan);
    useEffect(() => {
        scanHandler.current = scan;
    });
    useEffect(() => {
        keyboardBuffer.current = "";
        if (!nik || !ready || paused || confirm || pendingStart || busy) return;
        const handleKey = (event: KeyboardEvent) => {
            if (
                event.isComposing ||
                event.ctrlKey ||
                event.altKey ||
                event.metaKey ||
                event.repeat
            )
                return;
            const target = event.target;
            if (
                target instanceof HTMLElement &&
                (target.closest('[role="dialog"]') ||
                    (target.closest(
                            'input, textarea, select, [contenteditable="true"]',
                        ) &&
                        target !== input.current?.input))
            )
                return;
            if (target === input.current?.input) return;
            if (event.key === "Enter") {
                if (!keyboardBuffer.current) return;
                event.preventDefault();
                const value = keyboardBuffer.current;
                keyboardBuffer.current = "";
                void scanHandler.current(value);
            } else if (event.key === "Escape") {
                keyboardBuffer.current = "";
                setLabel("");
            } else if (event.key === "Backspace") {
                event.preventDefault();
                keyboardBuffer.current = keyboardBuffer.current.slice(0, -1);
                setLabel(keyboardBuffer.current);
            } else if (
                event.key.length === 1 &&
                keyboardBuffer.current.length < 255
            ) {
                event.preventDefault();
                keyboardBuffer.current += event.key;
                setLabel(keyboardBuffer.current);
            }
        };
        window.addEventListener("keydown", handleKey, true);
        const clearBuffer = () => {
            keyboardBuffer.current = "";
            setLabel("");
        };
        window.addEventListener("blur", clearBuffer);
        return () => {
            window.removeEventListener("keydown", handleKey, true);
            window.removeEventListener("blur", clearBuffer);
        };
    }, [nik, ready, paused, confirm, pendingStart, busy]);
    const seconds = session
        ? Math.max(0, Math.floor((now - Date.parse(session.StartedAt)) / 1000))
        : 0;
    const duration = `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    return (
        <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-3">
            <div className="flex flex-wrap items-center gap-4">
                <strong>Scan Assy</strong>
                <Tag color={session ? "processing" : "default"}>
                    {busy
                        ? "PROCESSING"
                        : !ready
                            ? "NOT READY"
                            : pendingStart || confirm
                                ? "AWAITING CONFIRMATION"
                                : session
                                    ? "IN PROGRESS"
                                    : "READY TO START"}
                </Tag>
                <Input
                    ref={input}
                    aria-label="Scan assembly label"
                    placeholder={
                        session
                            ? "Scan the same label to finish"
                            : "Scan label and press Enter"
                    }
                    value={label}
                    onChange={(e) => {
                        keyboardBuffer.current = e.target.value;
                        setLabel(e.target.value);
                    }}
                    onPressEnter={() => void scan()}
                    disabled={
                        !nik || !ready || paused || confirm || Boolean(pendingStart) || busy
                    }
                    style={{width: 340}}
                    autoComplete="off"
                />
                <Button onClick={() => void refresh()} disabled={busy}>
                    Refresh session
                </Button>
                {session && (
                    <span>
            <b>{session.ManPowerName}</b> · {session.LabelData.FinishGoodId} /{" "}
                        {session.LabelData.PartData.PartName} ·{" "}
                        {session.LabelData.QtyThisBox} pcs · <b>{duration}</b>
          </span>
                )}
            </div>
            {session && (
                <div className="mt-1 text-sm">
                    Label: {session.LabelData.LabelNumber} · Started:{" "}
                    {new Date(session.StartedAt).toLocaleString("id-ID")}
                </div>
            )}
            {!nik && (
                <span>Select manpower in the saved display settings to begin.</span>
            )}
            {error && (
                <Alert type="warning" title={error} showIcon className="mt-2"/>
            )}
            <Modal
                title="Start assembly?"
                open={Boolean(pendingStart)}
                centered
                confirmLoading={busy}
                okButtonProps={{disabled: !ready || paused}}
                onOk={() => void begin()}
                onCancel={() => {
                    if (!busy) {
                        setPendingStart(null);
                        startRequest.current = null;
                    }
                }}
                cancelButtonProps={{disabled: busy}}
                closable={!busy}
                mask={{closable: !busy}}
                getContainer={getContainer}
            >
                <p>
                    Label: <strong>{pendingStart}</strong>
                </p>
                <p>Start assembly using the manpower saved on this display?</p>
            </Modal>
            <Modal
                title="Complete assembly?"
                open={confirm && Boolean(session)}
                centered
                confirmLoading={busy}
                okButtonProps={{disabled: !ready}}
                onOk={() => void finish()}
                onCancel={() => {
                    if (!busy) setConfirm(false);
                }}
                cancelButtonProps={{disabled: busy}}
                closable={!busy}
                mask={{closable: !busy}}
                getContainer={getContainer}
            >
                <p>
                    {session?.LabelData.LabelNumber} · {session?.LabelData.FinishGoodId} ·{" "}
                    {session?.LabelData.QtyThisBox} pcs
                </p>
                <p>
                    Manpower: {session?.ManPowerName} · Duration: {duration}
                </p>
                <p>
                    Confirm that the entire box is assembled. Finish good stock will be
                    added.
                </p>
            </Modal>
        </div>
    );
}
