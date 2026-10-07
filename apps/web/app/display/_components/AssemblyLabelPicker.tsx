/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Modal, Select } from "antd";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store";
import {
  fetchDisplayReadyLabels,
  type AssemblySession,
} from "@/store/features/production/assembly/assemblySlice";

export default function AssemblyLabelPicker({
  onClose,
  onSelect,
  getContainer,
}: {
  onClose: () => void;
  onSelect: (label: string) => void;
  getContainer: () => HTMLElement;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const [labels, setLabels] = useState<AssemblySession["LabelData"][]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      dispatch(fetchDisplayReadyLabels(search))
        .unwrap()
        .then((result) => {
          if (current) setLabels(result);
        })
        .catch((err: unknown) => {
          if (current) setError(String(err));
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [dispatch, search, revision]);
  const reset = () => {
    setSelected(undefined);
    setLabels([]);
    setError(null);
    setLoading(true);
  };
  return (
    <Modal
      title="Select assembly label"
      open
      centered
      getContainer={getContainer}
      onCancel={onClose}
      okText="Start Assembly"
      okButtonProps={{ disabled: loading || Boolean(error) || !selected }}
      onOk={() => {
        if (selected && !loading && !error) onSelect(selected);
      }}
    >
      <p className="mb-3">
        Only boxes ready for assembly are listed (up to 100). Search by label
        number to find more.
      </p>
      {error && <Alert type="error" title={error} showIcon className="mb-3" />}
      <Select
        aria-label="Select ready assembly label"
        className="w-full"
        value={selected}
        onChange={setSelected}
        loading={loading}
        placeholder="Select or search label number"
        allowClear
        showSearch={{
          filterOption: false,
          onSearch: (value) => {
            reset();
            setSearch(value);
          },
        }}
        getPopupContainer={(trigger) => trigger.parentElement!}
        notFoundContent={
          loading ? "Loading labels…" : "No labels ready for assembly"
        }
        options={labels.map((item) => ({
          value: item.LabelNumber,
          label: `${item.LabelNumber} · Order ${item.ProductionDemandId} · ${item.PartData.PartName} · ${item.QtyThisBox} pcs`,
        }))}
      />
      <Button
        className="mt-3"
        onClick={() => {
          reset();
          setRevision((value) => value + 1);
        }}
      >
        Refresh labels
      </Button>
    </Modal>
  );
}
