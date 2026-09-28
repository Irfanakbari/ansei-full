/* By Irfan Akbari Vuteq Indonesia - 2026-09-28 */

"use client";

import {CopyOutlined} from "@ant-design/icons";
import {Alert, App, Button, Input, Modal, Space, Typography} from "antd";
import {formatDateTime} from "@/lib/utils/dateTime";
import type {EnrollmentToken} from "@/store/features/settings/printAgentSlice";

type Props = {
    open: boolean;
    enrollment: EnrollmentToken | null;
    onClose: () => void;
};

export default function EnrollmentTokenModal({open, enrollment, onClose}: Props) {
    const {message} = App.useApp();

    const copyToken = async () => {
        if (!enrollment) return;
        try {
            await navigator.clipboard.writeText(enrollment.token);
            message.success("Enrollment token copied");
        } catch {
            message.error("Unable to copy enrollment token");
        }
    };

    return (
        <Modal title="Enrollment Token" open={open} onCancel={onClose} centered destroyOnHidden width={620}
               mask={{closable: false}} closable footer={<Button type="primary" onClick={onClose}>Done</Button>}>
            {enrollment && (
                <Space orientation="vertical" size="middle" style={{width: "100%"}}>
                    <Alert type="warning" showIcon
                           message="This token is shown only once. Copy it now and store it securely."/>
                    <Input.TextArea value={enrollment.token} readOnly autoSize={{minRows: 3, maxRows: 6}}/>
                    <Button icon={<CopyOutlined/>} onClick={copyToken}>Copy Token</Button>
                    <Typography.Text type="secondary">
                        Expires at {formatDateTime(enrollment.expiresAt)}. The token cannot be recovered after this modal closes.
                    </Typography.Text>
                </Space>
            )}
        </Modal>
    );
}
