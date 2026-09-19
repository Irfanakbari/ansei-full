/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";
import { useRef, useState } from "react";
import { App, Modal } from "antd";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store";
import {
  completeInternalAssembly,
  type AssemblySession,
} from "@/store/features/production/assembly/assemblySlice";
import { createAssemblyRequestId } from "@/store/features/production/assembly/requestId";

export default function EndAssemblyModal({
  session,
  onClose,
  onCompleted,
}: {
  session: AssemblySession;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const requestId = useRef<string | null>(null);
  const complete = async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      requestId.current ??= createAssemblyRequestId();
      setSaving(true);
      await dispatch(
        completeInternalAssembly({
          id: session.Id,
          requestId: requestId.current,
        }),
      ).unwrap();
      message.success("Assembly completed");
      onCompleted();
    } catch (error) {
      if (typeof error === "string" || error instanceof Error)
        message.error(String(error));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  return (
    <Modal
      title="End Assembly"
      open
      centered
      okText="End Assembly"
      confirmLoading={saving}
      onOk={() => void complete()}
      onCancel={() => {
        if (!pending.current) onClose();
      }}
      closable={!saving}
      cancelButtonProps={{ disabled: saving }}
    >
      <p>
        <strong>{session.LabelData.LabelNumber}</strong>
      </p>
      <p>
        {session.LabelData.FinishGoodId} · {session.LabelData.PartData.PartName}
      </p>
      <p>Manpower: {session.ManPowerName}</p>
      <p className="mb-4">
        Completing this box adds {session.LabelData.QtyThisBox} pcs to
        finished-good stock.
      </p>
    </Modal>
  );
}
