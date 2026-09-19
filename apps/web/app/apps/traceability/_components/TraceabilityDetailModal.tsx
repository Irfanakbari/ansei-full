/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";

import {useEffect, useRef, useState} from "react";
import {Alert, Modal, Spin} from "antd";
import {useDispatch} from "react-redux";
import type {AppDispatch} from "@/store";
import {
    fetchTrace,
    fetchTraceEvents,
} from "@/store/features/traceability/traceabilitySlice";
import type {
    Page,
    TraceData,
    TraceEvent,
} from "@/store/features/traceability/types";
import TraceabilityDetail from "./TraceabilityDetail";

type TraceabilityDetailModalProps = {
    open: boolean;
    poId: string | null;
    onClose: () => void;
};

export default function TraceabilityDetailModal({
                                                    open,
                                                    poId,
                                                    onClose,
                                                }: TraceabilityDetailModalProps) {
    const dispatch = useDispatch<AppDispatch>();
    const requestRef = useRef(0);
    const [data, setData] = useState<TraceData | null>(null);
    const [events, setEvents] = useState<Page<TraceEvent> | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);

    useEffect(() => {
        const requestId = ++requestRef.current;
        setData(null);
        setEvents(null);
        setError("");
        setPage(1);

        if (!open || !poId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        void Promise.all([
            dispatch(fetchTrace(poId)).unwrap(),
            dispatch(fetchTraceEvents({poId, page: 1})).unwrap(),
        ])
            .then(([nextData, nextEvents]) => {
                if (requestRef.current === requestId) {
                    setData(nextData);
                    setEvents(nextEvents);
                }
            })
            .catch((reason: unknown) => {
                if (requestRef.current === requestId) {
                    setError(String(reason));
                }
            })
            .finally(() => {
                if (requestRef.current === requestId) {
                    setLoading(false);
                }
            });
    }, [dispatch, open, poId]);

    const handlePageChange = (nextPage: number) => {
        if (!poId) return;

        const requestId = ++requestRef.current;
        setPage(nextPage);
        setLoading(true);
        setError("");
        void dispatch(fetchTraceEvents({poId, page: nextPage}))
            .unwrap()
            .then((nextEvents) => {
                if (requestRef.current === requestId) {
                    setEvents(nextEvents);
                }
            })
            .catch((reason: unknown) => {
                if (requestRef.current === requestId) {
                    setError(String(reason));
                }
            })
            .finally(() => {
                if (requestRef.current === requestId) {
                    setLoading(false);
                }
            });
    };

    return (
        <Modal
            open={open}
            title={poId ? `Traceability — ${poId}` : "Traceability"}
            onCancel={onClose}
            footer={null}
            centered
            width="min(1400px, 96vw)"
            destroyOnHidden
            styles={{body: {maxHeight: "calc(100vh - 160px)", overflowY: "auto"}}}
        >
            {error && <Alert type="error" title={error} showIcon/>}
            <Spin spinning={loading && !data}>
                {data && (
                    <TraceabilityDetail
                        data={data}
                        events={events}
                        loading={loading}
                        page={page}
                        onPageChange={handlePageChange}
                    />
                )}
            </Spin>
        </Modal>
    );
}
