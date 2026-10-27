/* By Irfan Akbari Vuteq Indonesia - 2026-10-27 */
"use client";

import React, { useEffect, useState } from "react";
import {
  Modal,
  Form,
  Select,
  Input,
  Button,
  Alert,
  Space,
  Descriptions,
  App,
  Divider,
} from "antd";
import {
  CheckCircleOutlined,
  SendOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import {
  fetchAutocompleteApprovers,
  requestAutocompleteOtp,
  executeAutocompleteAll,
  type ProductionReleaseEntity,
} from "@/store/features/production/productionRelease/productionReleaseSlice";

interface Props {
  open: boolean;
  release: ProductionReleaseEntity | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AutocompleteReleaseModal({
  open,
  release,
  onClose,
  onSuccess,
}: Props) {
  const { message, modal } = App.useApp();
  const dispatch = useDispatch<AppDispatch>();
  const [form] = Form.useForm();

  const {
    autocompleteApprovers,
    autocompleteApproversLoading,
    autocompleteOtpRequesting,
    autocompleteExecuting,
  } = useSelector((state: RootState) => state.productionRelease);

  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [approverSentInfo, setApproverSentInfo] = useState<{
    name: string;
    phone: string;
  } | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (open) {
      void dispatch(fetchAutocompleteApprovers());
      setChallengeId(null);
      setApproverSentInfo(null);
      setCooldown(0);
      form.resetFields();
    }
  }, [open, dispatch, form]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!release) return null;

  const handleSendOtp = async () => {
    try {
      const values = await form.validateFields(["approverUserId"]);
      const res = await dispatch(
        requestAutocompleteOtp({
          id: release.Id,
          approverUserId: values.approverUserId,
        }),
      ).unwrap();

      setChallengeId(res.challengeId);
      setApproverSentInfo({
        name: res.approverName,
        phone: res.maskedPhoneNumber,
      });
      setCooldown(60);
      message.success(`OTP berhasil dikirim ke WhatsApp ${res.approverName}`);
    } catch (error: unknown) {
      const msg =
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Gagal meminta OTP";
      message.error(msg);
    }
  };

  const handleExecute = async () => {
    if (!challengeId) {
      message.warning("Silakan minta OTP terlebih dahulu.");
      return;
    }

    try {
      const values = await form.validateFields(["otp"]);
      const res = await dispatch(
        executeAutocompleteAll({
          id: release.Id,
          challengeId,
          otp: values.otp.trim(),
        }),
      ).unwrap();

      modal.success({
        title: "Proses Autocomplete Berhasil Selesai!",
        centered: true,
        content: (
          <div className="py-2">
            <p className="font-semibold text-emerald-600 mb-2">{res.message}</p>
            <ul className="text-xs space-y-1 list-disc pl-4 text-slate-600">
              <li>Demands selesai: {res.demandsProcessed}</li>
              <li>Shopping/Picking: {res.shoppingPicksCompleted} pick</li>
              <li>Assembly: {res.assemblySessionsCompleted} box</li>
              <li>Pokayoke: {res.pokayokeScanned} label</li>
              <li>Delivery: {res.deliveriesCreated} label</li>
              <li>Durasi tercatat: {res.totalProductionMinutes} menit</li>
            </ul>
          </div>
        ),
        onOk: () => {
          onSuccess();
          onClose();
        },
      });
    } catch (error: unknown) {
      const msg =
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Gagal menyelesaikan proses autocomplete";
      message.error(msg);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      centered={true}
      title={
        <Space>
          <SafetyCertificateOutlined className="text-emerald-600" />
          <span>Bypass & Autocomplete All Production Release</span>
        </Space>
      }
      width={560}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={autocompleteExecuting}>
          Batal
        </Button>,
        <Button
          key="execute"
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={autocompleteExecuting}
          disabled={!challengeId}
          onClick={handleExecute}
        >
          Konfirmasi & Selesaikan Semua
        </Button>,
      ]}
    >
      <div className="space-y-4 py-2">
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="Otorisasi & Otomatisasi Produksi"
          description="Aksi ini akan menyelesaikan seluruh proses (Shopping/Picking, Assembly, Pokayoke, dan Delivery) secara otomatis, membuat ledger stok resmi, sinkronisasi SAP, dan menutup status jadwal rilis menjadi COMPLETED. Diperlukan persetujuan OTP dari Manager/Super."
        />

        <Descriptions size="small" bordered column={1}>
          <Descriptions.Item label="Nomor Rilis">
            <span className="font-semibold">{release.ReleaseNumber}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Target Produksi">
            {release.TotalTargetQty} pcs
          </Descriptions.Item>
          <Descriptions.Item label="Status Saat Ini">
            <span className="text-blue-600 font-semibold">{release.Status}</span>
          </Descriptions.Item>
        </Descriptions>

        <Form form={form} layout="vertical" className="mt-2">
          <Form.Item
            name="approverUserId"
            label="Pilih Manager / Super untuk Menerima OTP"
            rules={[{ required: true, message: "Pilih salah satu approver" }]}
          >
            <Select
              placeholder="Pilih Manager atau Super"
              loading={autocompleteApproversLoading}
              disabled={autocompleteOtpRequesting || autocompleteExecuting}
              options={autocompleteApprovers.map((u) => ({
                value: u.userId,
                label: `${u.name} (${u.roleName}) - WA: ${u.maskedPhoneNumber}`,
              }))}
            />
          </Form.Item>

          <Button
            type="dashed"
            block
            icon={<SendOutlined />}
            loading={autocompleteOtpRequesting}
            disabled={cooldown > 0 || autocompleteExecuting}
            onClick={handleSendOtp}
          >
            {cooldown > 0
              ? `Kirim Ulang OTP (${cooldown}s)`
              : "Kirim OTP via WhatsApp"}
          </Button>

          {approverSentInfo && (
            <Alert
              className="mt-3"
              type="info"
              showIcon
              message={`OTP telah dikirim ke WhatsApp ${approverSentInfo.name} (${approverSentInfo.phone})`}
              description="Mintalah kode 6-digit OTP dari beliau dan masukkan pada kolom di bawah ini."
            />
          )}

          <Divider className="my-3" />

          <Form.Item
            name="otp"
            label="Masukkan Kode OTP (6 Digit)"
            rules={[
              { required: true, message: "Masukkan 6-digit kode OTP" },
              {
                pattern: /^\d{6}$/,
                message: "Kode OTP harus berupa 6 digit angka",
              },
            ]}
          >
            <Input.OTP
              length={6}
              disabled={!challengeId || autocompleteExecuting}
              size="large"
              className="w-full flex justify-center"
            />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
}
