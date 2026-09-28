/* By Irfan Akbari Vuteq Indonesia - 2026-09-28 */

"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {PlusOutlined, ReloadOutlined, SearchOutlined} from "@ant-design/icons";
import {Alert, Breadcrumb, Button, Card, Input, Space, Table, Tag} from "antd";
import type {InputRef, TableProps} from "antd";
import {useDispatch, useSelector} from "react-redux";
import ButtonToolbar from "@/components/ButtonToolbar";
import GoldenArrowAction from "@/components/GoldenArrowAction";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import {formatDateTime} from "@/lib/utils/dateTime";
import type {AppDispatch, RootState} from "@/store";
import {
    fetchPrintAgents,
    type EnrollmentToken,
    type PrintAgentConnectionStatus,
    type PrintAgentEntity,
    type PrintAgentStatus,
    setPrintAgentQuery,
} from "@/store/features/settings/printAgentSlice";
import CreatePrintAgentModal from "./_components/CreatePrintAgentModal";
import EnrollmentTokenModal from "./_components/EnrollmentTokenModal";
import PrintAgentModal from "./_components/PrintAgentModal";

const STATUS_FILTERS: {text: string; value: PrintAgentStatus}[] = [
    {text: "Active", value: "ACTIVE"},
    {text: "Disabled", value: "DISABLED"},
];

export default function PrinterConfigPage() {
    const dispatch = useDispatch<AppDispatch>();
    const {data, listLoading, listError, query, pagination} = useSelector((state: RootState) => state.printAgent);
    const [createOpen, setCreateOpen] = useState(false);
    const [detailAgentId, setDetailAgentId] = useState<string | null>(null);
    const [enrollment, setEnrollment] = useState<EnrollmentToken | null>(null);
    const searchInput = useRef<InputRef>(null);
    const refresh = useCallback(() => void dispatch(fetchPrintAgents(query)), [dispatch, query]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const columns: TableProps<PrintAgentEntity>["columns"] = [
        {
            title: "Name",
            dataIndex: "Name",
            key: "Name",
            filteredValue: query.search ? [query.search] : null,
            filterDropdown: ({setSelectedKeys, selectedKeys, confirm, clearFilters}) => (
                <div style={{padding: 8}} onKeyDown={(event) => event.stopPropagation()}>
                    <Input ref={searchInput} placeholder="Search Name" value={String(selectedKeys[0] ?? "")}
                           onChange={(event) => setSelectedKeys(event.target.value ? [event.target.value] : [])}
                           onPressEnter={() => confirm()} style={{marginBottom: 8, display: "block"}}/>
                    <Space>
                        <Button type="primary" onClick={() => confirm()} icon={<SearchOutlined/>} size="small" style={{width: 90}}>Search</Button>
                        <Button onClick={() => {
                            clearFilters?.();
                            confirm();
                        }} size="small" style={{width: 90}}>Reset</Button>
                    </Space>
                </div>
            ),
            filterIcon: (filtered) => <SearchOutlined style={{color: filtered ? "#1677ff" : undefined}}/>,
            render: (value: string, record) => (
                <Space size={4}>
                    <GoldenArrowAction tooltip="View print agent details" ariaLabel={`View print agent details for ${record.Name}`}
                                       onClick={() => setDetailAgentId(record.Id)}/>
                    <span>{value}</span>
                </Space>
            ),
        },
        {
            title: "Connection",
            dataIndex: "displayStatus",
            key: "displayStatus",
            align: "center",
            render: (value: PrintAgentConnectionStatus) => <Tag color={value === "ONLINE" ? "green" : "default"}>{value}</Tag>,
        },
        {
            title: "State",
            dataIndex: "Status",
            key: "Status",
            align: "center",
            filters: STATUS_FILTERS,
            filteredValue: query.status ? [query.status] : null,
            filterMultiple: false,
            render: (value: PrintAgentStatus) => <Tag color={value === "ACTIVE" ? "blue" : "red"}>{value}</Tag>,
        },
        {title: "Version", dataIndex: "Version", key: "Version", render: (value: string | null) => value || "-"},
        {title: "Profiles", dataIndex: "ProfilesCount", key: "ProfilesCount", align: "right", render: (value: number | null) => value ?? 0},
        {title: "Last Heartbeat", dataIndex: "LastHeartbeatAt", key: "LastHeartbeatAt", render: (value: string | null) => value ? formatDateTime(value) : "Never"},
        {title: "Created", dataIndex: "CreatedAt", key: "CreatedAt", render: formatDateTime},
        {title: "Updated", dataIndex: "UpdatedAt", key: "UpdatedAt", render: formatDateTime},
    ];

    return (
        <Card variant="borderless" styles={{body: {padding: 0}}}>
            <Breadcrumb style={{marginBottom: 16}}
                        items={[{title: "Home"}, {title: "System Administration"}, {title: "Printer Agent Config"}]}/>
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined/>} onClick={refresh}/>
                <ButtonToolbar title="Create" icon={<PlusOutlined/>} onClick={() => setCreateOpen(true)}/>
            </ToolbarWrapper>
            {listError && <Alert type="error" showIcon message={listError} style={{marginBottom: 12}}/>}
            <Table columns={columns} dataSource={data} size="small" loading={listLoading} rowKey="Id"
                   onChange={(pageInfo, filters) => {
                       const searchValue = filters.Name?.[0];
                       const statusValue = filters.Status?.[0];
                       dispatch(setPrintAgentQuery({
                           page: searchValue !== query.search || statusValue !== query.status ? 1 : pageInfo.current,
                           limit: pageInfo.pageSize,
                           search: typeof searchValue === "string" && searchValue ? searchValue : undefined,
                           status: typeof statusValue === "string" ? statusValue as PrintAgentStatus : undefined,
                       }));
                   }}
                   pagination={{
                       size: "small",
                       current: pagination.page,
                       pageSize: pagination.limit,
                       total: pagination.totalItems,
                       showSizeChanger: true,
                       showTotal: (total) => `Total ${total} records`,
                   }}
                   onRow={(record) => ({onDoubleClick: () => setDetailAgentId(record.Id)})}
                   scroll={{x: "max-content", y: "calc(100vh - 380px)"}} className="small-table" style={{fontSize: 11}}/>
            <CreatePrintAgentModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh}
                                   onEnrollmentCreated={setEnrollment}/>
            <PrintAgentModal open={detailAgentId !== null} agentId={detailAgentId} onClose={() => setDetailAgentId(null)}
                             onEnrollmentCreated={setEnrollment}/>
            <EnrollmentTokenModal open={enrollment !== null} enrollment={enrollment} onClose={() => setEnrollment(null)}/>
        </Card>
    );
}
