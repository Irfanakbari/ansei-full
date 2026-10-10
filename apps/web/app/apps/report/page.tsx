/* By Irfan Akbari Vuteq Indonesia - 2026-07-24 */
"use client";

import React, { useState } from "react";
import {
  Table,
  Card,
  Breadcrumb,
  Button,
  Space,
  DatePicker,
  Select,
  App,
  Modal,
  type TableColumnsType,
} from "antd";
import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import ButtonToolbar from "@/components/ButtonToolbar";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store";
import { downloadReport } from "@/store/features/report/reportThunks";
import dayjs, { Dayjs } from "dayjs";

const { RangePicker } = DatePicker;

interface ReportItem {
  key: string;
  name: string;
  description: string;
  hasDateFilter: boolean;
  hasCategoryFilter: boolean;
  hasLocationFilter: boolean;
  hasMonthFilter?: boolean;
}

const reports: ReportItem[] = [
  {
    key: "stock-material",
    name: "Stock Material Report",
    description: "Semua material aktif dengan informasi stock",
    hasDateFilter: false,
    hasCategoryFilter: false,
    hasLocationFilter: false,
  },
  {
    key: "incoming-warehouse",
    name: "Incoming Warehouse Report",
    description: "Data incoming warehouse dengan filter tanggal",
    hasDateFilter: true,
    hasCategoryFilter: false,
    hasLocationFilter: false,
  },
  {
    key: "incoming-rack",
    name: "Incoming Rack Report",
    description: "Data transfer to rack dengan filter tanggal",
    hasDateFilter: true,
    hasCategoryFilter: false,
    hasLocationFilter: false,
  },
  {
    key: "transfer-material",
    name: "Transfer Material Report",
    description: "Delivery note material dengan filter tanggal",
    hasDateFilter: true,
    hasCategoryFilter: false,
    hasLocationFilter: false,
  },
  {
    key: "production-release",
    name: "Production Release Report",
    description: "Data production release dengan filter tanggal",
    hasDateFilter: true,
    hasCategoryFilter: false,
    hasLocationFilter: false,
  },
  {
    key: "pokayoke-scan",
    name: "Pokayoke Scan Report",
    description: "History scan pokayoke dengan filter tanggal",
    hasDateFilter: true,
    hasCategoryFilter: false,
    hasLocationFilter: false,
  },
  {
    key: "delivery-history",
    name: "Delivery History Report",
    description: "History delivery dengan filter tanggal",
    hasDateFilter: true,
    hasCategoryFilter: false,
    hasLocationFilter: false,
  },
  {
    key: "delivery-monthly",
    name: "Delivery Report (Monthly)",
    description:
      "Monthly Forecast, completed Delivered forecast, and actual Received worksheets",
    hasDateFilter: false,
    hasCategoryFilter: false,
    hasLocationFilter: false,
    hasMonthFilter: true,
  },
  {
    key: "production-report",
    name: "Production Report",
    description: "Data laporan produksi dengan filter tanggal",
    hasDateFilter: true,
    hasCategoryFilter: false,
    hasLocationFilter: false,
  },
  {
    key: "shopping-history",
    name: "Shopping History Report",
    description: "History shopping/picking dengan filter tanggal",
    hasDateFilter: true,
    hasCategoryFilter: false,
    hasLocationFilter: false,
  },
  {
    key: "inventory-ledger",
    name: "Inventory Ledger Report",
    description:
      "Buku besar inventory dengan filter tanggal, kategori, dan lokasi",
    hasDateFilter: true,
    hasCategoryFilter: true,
    hasLocationFilter: true,
  },
];

const ReportPage: React.FC = () => {
  const { message } = App.useApp();
  const dispatch = useDispatch<AppDispatch>();
  const [monthlyReport, setMonthlyReport] = useState<ReportItem | null>(null);
  const [month, setMonth] = useState<Dayjs | null>(dayjs());
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [location, setLocation] = useState<string | undefined>(undefined);

  const handleDownload = async (report: ReportItem) => {
    if (report.hasMonthFilter && !month) {
      message.warning("Please select a report month");
      return;
    }
    try {
      setDownloading(report.key);
      await dispatch(
        downloadReport({
          key: report.key,
          filename: `${report.name.replace(/\s+/g, "_")}_${dayjs().format("YYYY-MM-DD")}.xlsx`,
          ...(report.hasDateFilter && dateRange?.[0] && dateRange?.[1]
            ? {
                fromdate: dateRange[0].format("DDMMYYYY"),
                todate: dateRange[1].format("DDMMYYYY"),
              }
            : {}),
          ...(report.hasCategoryFilter && category ? { category } : {}),
          ...(report.hasLocationFilter && location ? { location } : {}),
          ...(report.hasMonthFilter && month
            ? { month: month.format("YYYY-MM") }
            : {}),
        }),
      ).unwrap();
      if (report.hasMonthFilter) setMonthlyReport(null);
      message.success(`${report.name} downloaded successfully`);
    } catch (error: unknown) {
      message.error(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Failed to download report",
      );
    } finally {
      setDownloading(null);
    }
  };

  const handleClearFilters = () => {
    setDateRange(null);
    setCategory(undefined);
    setLocation(undefined);
  };

  const exportFilters = (
    <div style={{ padding: 12, maxWidth: 420 }}>
      <Space wrap size="middle">
        <RangePicker
          value={dateRange}
          onChange={(dates) => setDateRange(dates)}
          format="DD/MM/YYYY"
          placeholder={["Start Date", "End Date"]}
          allowClear
          size="small"
        />
        <Select
          placeholder="Category"
          value={category}
          onChange={setCategory}
          allowClear
          style={{ width: 140 }}
          size="small"
          options={[
            { value: "MATERIAL", label: "Material" },
            { value: "FINISH_GOOD", label: "Finish Good" },
          ]}
        />
        <Select
          placeholder="Location"
          value={location}
          onChange={setLocation}
          allowClear
          style={{ width: 160 }}
          size="small"
          options={[
            { value: "WAREHOUSE", label: "Warehouse" },
            { value: "RACK", label: "Rack" },
            { value: "FINISH_GOOD_AREA", label: "Finish Good Area" },
          ]}
        />
        <ButtonToolbar
          title="Clear Filters"
          icon={<ReloadOutlined />}
          onClick={handleClearFilters}
        />
      </Space>
    </div>
  );
  const columns: TableColumnsType<ReportItem> = [
    {
      title: "#",
      key: "index",
      render: (_: unknown, __: ReportItem, index: number) => index + 1,
    },
    {
      title: "Report Name",
      dataIndex: "name",
      key: "name",
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
    },
    {
      title: "Filters",
      key: "filters",
      filterDropdown: () => exportFilters,
      filtered: Boolean(dateRange || category || location),
      render: (_: unknown, record: ReportItem) => (
        <Space size="small">
          {record.hasMonthFilter && (
            <span className="ant-tag ant-tag-orange">Month</span>
          )}
          {record.hasDateFilter && (
            <span className="ant-tag ant-tag-orange">Date Range</span>
          )}
          {record.hasCategoryFilter && (
            <span className="ant-tag ant-tag-blue">Category</span>
          )}
          {record.hasLocationFilter && (
            <span className="ant-tag ant-tag-green">Location</span>
          )}
          {!record.hasDateFilter &&
            !record.hasCategoryFilter &&
            !record.hasLocationFilter &&
            !record.hasMonthFilter && (
              <span className="ant-tag ant-tag-gray">No Filter</span>
            )}
        </Space>
      ),
    },
    {
      title: "Action",
      key: "action",
      align: "center" as const,
      render: (_: unknown, record: ReportItem) => (
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          loading={downloading === record.key}
          disabled={downloading !== null}
          onClick={() =>
            record.hasMonthFilter
              ? setMonthlyReport(record)
              : void handleDownload(record)
          }
          size="small"
        >
          Download
        </Button>
      ),
    },
  ];

  return (
    <Card variant="borderless" styles={{ body: { padding: 0 } }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[{ title: "Home" }, { title: "Report" }]}
      />

      <Table
        columns={columns}
        dataSource={reports}
        rowKey="key"
        pagination={false}
        size="small"
        scroll={{ x: "max-content", y: "calc(100vh - 320px)" }}
        className="small-table"
        style={{ fontSize: "11px" }}
      />
      <Modal
        title="Delivery Report (Monthly)"
        open={monthlyReport !== null}
        centered
        onCancel={() => {
          if (!downloading) setMonthlyReport(null);
        }}
        onOk={() => {
          if (monthlyReport) void handleDownload(monthlyReport);
        }}
        okText="Download Excel"
        confirmLoading={downloading === "delivery-monthly"}
        okButtonProps={{ disabled: !month || downloading !== null }}
        cancelButtonProps={{ disabled: downloading !== null }}
      >
        <p>
          Download Forecast, completed Delivered forecast, and actual Received
          for the selected month.
        </p>
        <DatePicker
          picker="month"
          value={month}
          onChange={setMonth}
          format="MMMM YYYY"
          allowClear={false}
          aria-label="Report month"
          style={{ width: "100%" }}
        />
      </Modal>
    </Card>
  );
};

export default ReportPage;
