/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  App,
  Avatar,
  Button,
  Descriptions,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  Upload,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  MinusCircleOutlined,
  PictureOutlined,
  PlusOutlined,
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/store";
import {
  deleteManPower,
  deleteManPowerPicture,
  ManPowerEntity,
  updateManPower,
  uploadManPowerPicture,
} from "@/store/features/master/manPowerSlice";
import type { EmployeeType } from "@/store/features/master/manPowerSlice";
import { formatDateTime } from "@/lib/utils/dateTime";
import { toBrowserManPowerPhotoUrl } from "@/lib/nas-media-url";

const { Text } = Typography;
const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
type FormValues = {
  nik: string;
  name: string;
  employeeType: EmployeeType;
  line?: string;
  status?: boolean;
  skillMatrix?: { label: string; point: number }[];
};
type Props = {
  open: boolean;
  data: ManPowerEntity | null;
  onClose: () => void;
  onChanged: () => void;
};

export default function ManPowerModal({
  open,
  data,
  onClose,
  onChanged,
}: Props) {
  const { message, modal } = App.useApp();
  const dispatch = useDispatch<AppDispatch>();
  const [form] = Form.useForm<FormValues>();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeExistingPicture, setRemoveExistingPicture] = useState(false);
  const saveInFlight = useRef(false);
  const deleteInFlight = useRef(false);

  const resetPicture = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setRemoveExistingPicture(false);
  };
  useEffect(() => {
    if (!open) {
      setEditing(false);
      resetPicture();
    }
  }, [open]);
  useEffect(() => {
    if (!open || !editing || !data) return;
    resetPicture();
    form.setFieldsValue({
      nik: data.Nik,
      name: data.Name,
      employeeType: data.EmployeeType,
      line: data.Line ?? undefined,
      status: data.Status,
      skillMatrix:
        data.SkillMatrix?.map((skill) => ({
          label: skill.Label,
          point: skill.Point,
        })) ?? [],
    });
  }, [data, editing, form, open]);
  if (!data) return null;

  const getError = (error: unknown, fallback: string) =>
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : fallback;
  const selectFile = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (
      !allowedTypes.includes(file.type) &&
      !["png", "jpg", "jpeg", "gif", "webp"].includes(extension ?? "")
    ) {
      message.error(
        "Format file tidak didukung. Harap upload gambar (PNG, JPG, JPEG, GIF, WEBP).",
      );
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error("Ukuran file terlalu besar. Maksimal 5MB.");
      return false;
    }
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
    setSelectedFile(file);
    setRemoveExistingPicture(false);
    return false;
  };
  const close = () => {
    if (saving || deleting) return;
    resetPicture();
    if (editing) {
      form.resetFields();
      setEditing(false);
    }
    onClose();
  };
  const save = async () => {
    if (saveInFlight.current) return;
    try {
      const values = await form.validateFields();
      saveInFlight.current = true;
      setSaving(true);
      await dispatch(
        updateManPower({
          uid: data.Uid,
          data: { ...values, skillMatrix: values.skillMatrix ?? [] },
        }),
      ).unwrap();
      if (selectedFile) {
        try {
          await dispatch(
            uploadManPowerPicture({ uid: data.Uid, file: selectedFile }),
          ).unwrap();
        } catch (error: unknown) {
          message.warning(
            `Data diperbarui, tetapi gagal mengunggah foto: ${getError(error, "Failed to upload picture")}`,
          );
        }
      } else if (removeExistingPicture && data.PicturePath) {
        try {
          await dispatch(deleteManPowerPicture(data.Uid)).unwrap();
        } catch (error: unknown) {
          message.warning(
            `Data diperbarui, tetapi gagal menghapus foto lama: ${getError(error, "Failed to delete picture")}`,
          );
        }
      }
      message.success("Man power updated successfully");
      form.resetFields();
      setEditing(false);
      resetPicture();
      onChanged();
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "errorFields" in error)
        return;
      message.error(getError(error, "Failed to update man power"));
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };
  const remove = () =>
    modal.confirm({
      title: "Delete Man Power?",
      icon: <DeleteOutlined />,
      content: `Delete man power ${data.Name}?`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      centered: true,
      onOk: async () => {
        if (deleteInFlight.current) return;
        deleteInFlight.current = true;
        setDeleting(true);
        try {
          await dispatch(deleteManPower(data.Uid)).unwrap();
          message.success("Man power deleted successfully");
          onChanged();
          onClose();
        } catch (error: unknown) {
          message.error(getError(error, "Failed to delete man power"));
          throw error;
        } finally {
          deleteInFlight.current = false;
          setDeleting(false);
        }
      },
    });
  const displayPicture =
    previewUrl || (!removeExistingPicture ? data.PicturePath : null);

  return (
    <Modal
      title={
        <Space>
          {editing ? <EditOutlined /> : <EyeOutlined />}
          <span>
            {editing ? "Edit" : "Detail"} Man Power - {data.Name}
          </span>
        </Space>
      }
      open={open}
      onCancel={close}
      centered
      width={600}
      destroyOnHidden
      mask={{ closable: !saving && !deleting }}
      closable={!saving && !deleting}
      footer={
        editing
          ? [
              <Button
                key="cancel"
                onClick={() => {
                  form.resetFields();
                  resetPicture();
                  setEditing(false);
                }}
                disabled={saving}
              >
                Cancel
              </Button>,
              <Button key="save" type="primary" onClick={save} loading={saving}>
                Save
              </Button>,
            ]
          : [
              <Button
                key="delete"
                danger
                icon={<DeleteOutlined />}
                onClick={remove}
                loading={deleting}
              >
                Delete
              </Button>,
              <Button
                key="edit"
                type="primary"
                icon={<EditOutlined />}
                onClick={() => setEditing(true)}
                disabled={deleting}
              >
                Edit
              </Button>,
            ]
      }
    >
      {editing ? (
        <Form form={form} layout="vertical">
          <Form.Item
            name="nik"
            label="NIK"
            rules={[
              {
                required: true,
                message: "Please enter NIK",
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Please enter name" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="employeeType"
            label="Employee Type"
            rules={[{ required: true, message: "Please select employee type" }]}
          >
            <Select
              options={[
                { value: "DAILY", label: "DAILY" },
                { value: "PCS", label: "PCS" },
              ]}
            />
          </Form.Item>
          <Form.Item name="line" label="Line">
            <Input />
          </Form.Item>
          <Form.Item label="Foto Karyawan (Max 5MB)">
            {displayPicture ? (
              <Space>
                <Image
                  src={toBrowserManPowerPhotoUrl(displayPicture) ?? undefined}
                  alt="Foto Manpower"
                  preview={false}
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "cover",
                    borderRadius: 6,
                    border: "1px solid #d9d9d9",
                  }}
                />
                <Space orientation="vertical" size={2}>
                  {selectedFile ? (
                    <Text ellipsis style={{ maxWidth: 220 }}>
                      {selectedFile.name}
                    </Text>
                  ) : (
                    <Text type="secondary">Foto saat ini</Text>
                  )}
                  <Space>
                    <Upload
                      beforeUpload={selectFile}
                      maxCount={1}
                      showUploadList={false}
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    >
                      <Button size="small" icon={<UploadOutlined />}>
                        Ganti
                      </Button>
                    </Upload>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() =>
                        selectedFile
                          ? (setSelectedFile(null), setPreviewUrl(null))
                          : (setRemoveExistingPicture(true),
                            setSelectedFile(null),
                            setPreviewUrl(null))
                      }
                    >
                      Hapus
                    </Button>
                  </Space>
                </Space>
              </Space>
            ) : (
              <Space>
                <Avatar icon={<UserOutlined />} size={64} shape="square" />
                <Upload
                  beforeUpload={selectFile}
                  maxCount={1}
                  showUploadList={false}
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                >
                  <Button icon={<UploadOutlined />}>Upload Foto</Button>
                </Upload>
              </Space>
            )}
            <div>
              <Text type="secondary">
                <PictureOutlined /> Format yang didukung: PNG, JPG, JPEG, GIF,
                WEBP (maks. 5MB)
              </Text>
            </div>
          </Form.Item>
          <Text strong>Skill Matrix</Text>
          <Form.List name="skillMatrix">
            {(fields, { add, remove: removeSkill }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Space
                    key={key}
                    style={{ display: "flex", marginBottom: 8 }}
                    align="baseline"
                  >
                    <Form.Item
                      {...rest}
                      name={[name, "label"]}
                      rules={[
                        {
                          required: true,
                          message: "Missing skill name",
                        },
                      ]}
                      style={{ margin: 0 }}
                    >
                      <Input placeholder="Skill Label (e.g. Assembly)" />
                    </Form.Item>
                    <Form.Item
                      {...rest}
                      name={[name, "point"]}
                      rules={[
                        {
                          required: true,
                          message: "Missing point",
                        },
                      ]}
                      style={{ margin: 0 }}
                    >
                      <InputNumber
                        min={1}
                        max={4}
                        placeholder="Poin 1-4"
                        style={{ width: 100 }}
                      />
                    </Form.Item>
                    <MinusCircleOutlined
                      onClick={() => removeSkill(name)}
                      style={{ color: "red" }}
                    />
                  </Space>
                ))}
                <Form.Item>
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                  >
                    Add Skill
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
          <Form.Item
            name="status"
            label="Active Status"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      ) : (
        <>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="NIK">{data.Nik}</Descriptions.Item>
            <Descriptions.Item label="Name">{data.Name}</Descriptions.Item>
            <Descriptions.Item label="Employee Type">
              {data.EmployeeType}
            </Descriptions.Item>
            <Descriptions.Item label="Line">
              {data.Line || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={data.Status ? "green" : "red"}>
                {data.Status ? "Active" : "Inactive"}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Photo">
              {data.PicturePath ? (
                <Avatar
                  src={toBrowserManPowerPhotoUrl(data.PicturePath)}
                  size={64}
                  shape="square"
                />
              ) : (
                <Avatar icon={<UserOutlined />} size={64} shape="square" />
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Created Date">
              {formatDateTime(data.CreatedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Created By">
              {data.CreatedByName || data.CreatedBy || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Updated Date">
              {formatDateTime(data.UpdatedAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Updated By">
              {data.UpdatedByName || data.UpdatedBy || "-"}
            </Descriptions.Item>
          </Descriptions>
          <Text strong>Skill Matrix</Text>
          {data.SkillMatrix?.length ? (
            data.SkillMatrix.map((skill) => (
              <Tag key={skill.Id} style={{ marginTop: 8 }}>
                {skill.Label}: {skill.Point}
              </Tag>
            ))
          ) : (
            <Text type="secondary"> No skills</Text>
          )}
        </>
      )}
    </Modal>
  );
}
