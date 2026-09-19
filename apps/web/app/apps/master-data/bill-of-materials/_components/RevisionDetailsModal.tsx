/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";
import {useCallback, useState} from "react";
import {App, Modal} from "antd";
import RevisionDetails from "./RevisionDetails";

type RevisionDetailsModalProps = {
    open: boolean;
    revisionId: string | null;
    onClose: () => void;
    onChanged: () => void;
};

export default function RevisionDetailsModal({
                                                 open,
                                                 revisionId,
                                                 onClose,
                                                 onChanged,
                                             }: RevisionDetailsModalProps) {
    const {modal} = App.useApp();
    const [activeRevisionId, setActiveRevisionId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const displayedRevisionId = activeRevisionId ?? revisionId;
    const handleClose = () => {
        if (saving) return;
        if (!hasUnsavedChanges) {
            onClose();
            return;
        }
        modal.confirm({
            centered: true,
            title: "Discard unsaved changes?",
            content: "Your unsaved BOM revision changes will be lost.",
            okText: "Discard",
            okButtonProps: {danger: true},
            onOk: onClose,
        });
    };
    const handleStatusChange = useCallback(
        (status: { saving: boolean; hasUnsavedChanges: boolean }) => {
            setSaving(status.saving);
            setHasUnsavedChanges(status.hasUnsavedChanges);
        },
        [],
    );
    return (
        <Modal
            centered
            open={open}
            title="BOM Revision Details"
            width="min(1200px, calc(100vw - 32px))"
            footer={null}
            destroyOnHidden
            closable={{disabled: saving}}
            keyboard={!saving}
            mask={{closable: !saving}}
            onCancel={handleClose}
            afterOpenChange={(isOpen) => {
                if (!isOpen) {
                    setActiveRevisionId(null);
                    setSaving(false);
                    setHasUnsavedChanges(false);
                }
            }}
            styles={{body: {maxHeight: "calc(100vh - 160px)", overflowY: "auto"}}}
        >
            {displayedRevisionId && (
                <RevisionDetails
                    key={displayedRevisionId}
                    id={displayedRevisionId}
                    presentation="modal"
                    onChanged={onChanged}
                    onRevisionCreated={setActiveRevisionId}
                    onStatusChange={handleStatusChange}
                />
            )}
        </Modal>
    );
}
