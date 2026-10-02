/*By Irfan Akbari Vuteq Indonesia - 2026-06-12 - Updated 2026-06-16*/
"use client";

import React, {useState, useEffect, useRef, useCallback} from 'react';
import {Modal, Button, Space, App, Spin} from 'antd';
import {DownloadOutlined, PrinterOutlined, FilePdfOutlined} from '@ant-design/icons';

interface Props {
    visible: boolean;
    onClose: () => void;
    deliveryNoteId: string;
    deliveryNoteNum: string;
}

const DeliveryNotePreviewModal: React.FC<Props> = ({
                                                       visible,
                                                       onClose,
                                                       deliveryNoteId,
                                                       deliveryNoteNum,
                                                   }) => {
    const {message: antMessage} = App.useApp();
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const pdfUrlRef = useRef<string | null>(null);

    const fetchPdf = useCallback(async () => {
        setLoading(true);
        setError(null);
        setPdfUrl(null);

        try {
            const response = await fetch(`/api/warehouse/transfer-material/${deliveryNoteId}/generate-dn`, {
                method: 'POST',
                credentials: 'include',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to fetch Delivery Note');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            pdfUrlRef.current = url;
            setPdfUrl(url);
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Failed to fetch Delivery Note';
            setError(errMsg);
            antMessage.error(errMsg);
        } finally {
            setLoading(false);
        }
    }, [deliveryNoteId, antMessage]);

    useEffect(() => {
        if (visible && deliveryNoteId) {
            fetchPdf();
        }

        return () => {
            // Cleanup blob URL on unmount
            if (pdfUrlRef.current) {
                window.URL.revokeObjectURL(pdfUrlRef.current);
                pdfUrlRef.current = null;
            }
        };
    }, [visible, deliveryNoteId, fetchPdf]);

    const handleDownload = () => {
        if (!pdfUrl) return;

        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `DN-${deliveryNoteNum}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        antMessage.success('File downloaded successfully');
    };

    const handlePrint = () => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.print();
        } else {
            antMessage.warning('Print not available for this browser');
        }
    };

    const handleClose = () => {
        if (pdfUrlRef.current) {
            window.URL.revokeObjectURL(pdfUrlRef.current);
            pdfUrlRef.current = null;
        }
        setPdfUrl(null);
        setError(null);
        onClose();
    };

    return (
        <Modal
            title={
                <Space>
                    <FilePdfOutlined/>
                    <span>Delivery Note: {deliveryNoteNum}</span>
                </Space>
            }
            open={visible}
            onCancel={handleClose}
            footer={
                <Space>
                    <Button
                        icon={<DownloadOutlined/>}
                        onClick={handleDownload}
                        disabled={!pdfUrl || loading}
                    >
                        Download
                    </Button>
                    <Button
                        type="primary"
                        icon={<PrinterOutlined/>}
                        onClick={handlePrint}
                        disabled={!pdfUrl || loading}
                    >
                        Print
                    </Button>
                </Space>
            }
            centered
            width={800}
            style={{top: 20}}
            zIndex={1050}
            styles={{
                body: {
                    height: '70vh',
                    padding: 0,
                    background: '#f5f5f5',
                },
            }}
        >
            <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#e8e8e8',
            }}>
                {loading && (
                    <Spin description="Loading document..." size="large"/>
                )}

                {error && !loading && (
                    <div style={{textAlign: 'center', color: '#ff4d4f'}}>
                        <FilePdfOutlined style={{fontSize: 48, marginBottom: 16}}/>
                        <div>{error}</div>
                        <Button
                            type="link"
                            onClick={fetchPdf}
                            style={{marginTop: 8}}
                        >
                            Try again
                        </Button>
                    </div>
                )}

                {!loading && !error && pdfUrl && (
                    <iframe
                        ref={iframeRef}
                        src={pdfUrl}
                        style={{
                            width: '100%',
                            height: '100%',
                            border: 'none',
                            background: 'white',
                        }}
                        title={`DN-${deliveryNoteNum}`}
                    />
                )}
            </div>
        </Modal>
    );
};

export default DeliveryNotePreviewModal;