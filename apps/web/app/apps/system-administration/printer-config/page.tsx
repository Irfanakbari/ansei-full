"use client";

import {useEffect, useRef, useState} from "react";
import {PlusOutlined, ReloadOutlined, SearchOutlined} from "@ant-design/icons";
import {Breadcrumb, Button, Card, Input, Space, Table, Tag} from "antd";
import type {InputRef, TableProps} from "antd";
import type {FilterDropdownProps} from "antd/es/table/interface";
import {useDispatch, useSelector} from "react-redux";
import ButtonToolbar from "@/components/ButtonToolbar";
import GoldenArrowAction from "@/components/GoldenArrowAction";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import {useSingleRowSelection} from "@/hooks/useSingleRowSelection";
import {AppDispatch, RootState} from "@/store";
import {
    fetchPrinterSettings,
    PrinterSettingEntity,
    setPrinterSettingQuery
} from "@/store/features/settings/printerSettingSlice";
import {formatDateTime} from "@/lib/utils/dateTime";
import CreatePrinterSettingModal from "./_components/CreatePrinterSettingModal";
import PrinterSettingModal from "./_components/PrinterSettingModal";

export default function PrinterConfigPage() {
    const dispatch = useDispatch<AppDispatch>();
    const {data, loading, query, pagination} = useSelector((state: RootState) => state.printerSetting);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [modalData, setModalData] = useState<PrinterSettingEntity | null>(null);
    const searchInput = useRef<InputRef>(null);
    const {selectRecord, clearSelection, isSelected} = useSingleRowSelection(data, (record) => record.Id);

    useEffect(() => {
        void dispatch(fetchPrinterSettings(query));
    }, [dispatch, query]);

    const searchColumn = (placeholder: string) => ({
        filterDropdown: ({
                             setSelectedKeys,
                             selectedKeys,
                             confirm,
                             clearFilters
                         }: FilterDropdownProps) =>
            <div style={{padding: 8}} onKeyDown={(event) => event.stopPropagation()}>
                <Input ref={searchInput} placeholder={placeholder} value={String(selectedKeys[0] ?? "")}
                       onChange={(event) => setSelectedKeys(event.target.value ? [event.target.value] : [])}
                       onPressEnter={() => confirm()} style={{marginBottom: 8, display: "block"}}/>
                <Space><Button type="primary" onClick={() => confirm()} icon={<SearchOutlined/>} size="small"
                               style={{width: 90}}>Search</Button><Button onClick={() => {
                    clearFilters?.();
                    confirm();
                }} size="small" style={{width: 90}}>Reset</Button></Space>
            </div>,
        filterIcon: (filtered: boolean) => <SearchOutlined style={{color: filtered ? "#1677ff" : undefined}}/>,
        filteredValue: query.search ? [query.search] : null,
    });

    const columns: TableProps<PrinterSettingEntity>["columns"] = [
        {
            title: "Printer Name", dataIndex: "Name", key: "Name", ...searchColumn("Search Printer Name"),
            render: (value, record) => <Space size={4}>
                <GoldenArrowAction tooltip="View printer setting details"
                                   ariaLabel={`View printer setting details for ${value || record.IpAddress}`}
                                   onClick={() => {
                                       selectRecord(record);
                                       setModalData(record);
                                   }}/>
                <span>{value}</span>
            </Space>
        },
        {
            title: "IP Address",
            dataIndex: "IpAddress",
            key: "IpAddress",
            render: (value: string) => <Tag color="blue">{value}</Tag>, ...searchColumn("Search IP Address")
        },
        {
            title: "Created By",
            dataIndex: "CreatedBy",
            key: "CreatedBy",
            render: (_, record) => record.CreatedByName || "-", ...searchColumn("Search Created By")
        },
        {title: "Created At", dataIndex: "CreatedAt", key: "CreatedAt", render: formatDateTime},
    ];

    return <Card variant="borderless" styles={{body: {padding: 0}}}>
        <Breadcrumb style={{marginBottom: 16}}
                    items={[{title: "Home"}, {title: "System Administration"}, {title: "Printer Config"}]}/>
        <ToolbarWrapper><ButtonToolbar title="Refresh" icon={<ReloadOutlined/>}
                                       onClick={() => void dispatch(fetchPrinterSettings(query))}/><ButtonToolbar
            title="Create" icon={<PlusOutlined/>} onClick={() => setIsCreateModalVisible(true)}/></ToolbarWrapper>
        <Table columns={columns} dataSource={data} size="small" loading={loading} rowKey="Id"
               onChange={(pageInfo, activeFilters) => dispatch(setPrinterSettingQuery({
                   page: Object.values(activeFilters).some(Boolean) ? 1 : pageInfo.current,
                   limit: pageInfo.pageSize,
                   search: String(activeFilters.Name?.[0] ?? activeFilters.IpAddress?.[0] ?? activeFilters.CreatedBy?.[0] ?? "")
               }))}
               onRow={(record) => ({onClick: () => selectRecord(record)})}
               rowClassName={(record) => isSelected(record) ? "ant-table-row-selected" : ""}
               pagination={{
                   size: "small",
                   current: pagination.page,
                   pageSize: pagination.limit,
                   total: pagination.totalItems,
                   showSizeChanger: true,
                   showTotal: (total) => `Total ${total} records`
               }}
               scroll={{x: "max-content", y: "calc(100vh - 380px)"}} className="small-table"
               style={{fontSize: "11px"}}/>
        <PrinterSettingModal visible={modalData !== null} data={modalData} onClose={() => setModalData(null)}
                             onUpdated={() => void dispatch(fetchPrinterSettings(query))} onDeleted={() => {
            clearSelection();
            setModalData(null);
            void dispatch(fetchPrinterSettings(query));
        }}/>
        <CreatePrinterSettingModal visible={isCreateModalVisible} onClose={() => setIsCreateModalVisible(false)}
                                   onSuccess={() => void dispatch(fetchPrinterSettings(query))}/>
    </Card>;
}
