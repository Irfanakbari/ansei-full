"use client";

import {useEffect, useRef, useState} from "react";
import type {Key} from "react";
import {PlusOutlined, ReloadOutlined, SearchOutlined} from "@ant-design/icons";
import {Breadcrumb, Button, Card, Input, Space, Table} from "antd";
import type {InputRef, TableProps} from "antd";
import type {FilterDropdownProps} from "antd/es/table/interface";
import {useDispatch, useSelector} from "react-redux";
import ButtonToolbar from "@/components/ButtonToolbar";
import GoldenArrowAction from "@/components/GoldenArrowAction";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import {useSingleRowSelection} from "@/hooks/useSingleRowSelection";
import {AppDispatch, RootState} from "@/store";
import {fetchPermissions, PermissionData} from "@/store/features/permissions/permissionsSlice";
import CreatePermissionModal from "./_components/CreatePermissionModal";
import PermissionModal from "./_components/PermissionModal";

export default function PermissionsSetupPage() {
    const dispatch = useDispatch<AppDispatch>();
    const {data, loading} = useSelector((state: RootState) => state.permission);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [modalData, setModalData] = useState<PermissionData | null>(null);
    const [filters, setFilters] = useState<Record<string, string>>({});
    const searchInput = useRef<InputRef>(null);
    const {selectRecord, clearSelection, isSelected} = useSingleRowSelection(data, (record) => record.Id);

    useEffect(() => {
        void dispatch(fetchPermissions());
    }, [dispatch]);

    const searchColumn = (dataIndex: "Action" | "Description") => ({
        filterDropdown: ({
                             setSelectedKeys,
                             selectedKeys,
                             confirm,
                             clearFilters
                         }: FilterDropdownProps) =>
            <div style={{padding: 8}} onKeyDown={(event) => event.stopPropagation()}>
                <Input ref={searchInput} placeholder={`Search ${dataIndex}`} value={String(selectedKeys[0] ?? "")}
                       onChange={(event) => setSelectedKeys(event.target.value ? [event.target.value] : [])}
                       onPressEnter={() => confirm()} style={{marginBottom: 8, display: "block"}}/>
                <Space><Button type="primary" onClick={() => confirm()} icon={<SearchOutlined/>} size="small"
                               style={{width: 90}}>Search</Button><Button onClick={() => {
                    clearFilters?.();
                    confirm();
                }} size="small" style={{width: 90}}>Reset</Button></Space>
            </div>,
        filterIcon: (filtered: boolean) => <SearchOutlined style={{color: filtered ? "#1677ff" : undefined}}/>,
        filteredValue: filters[dataIndex] ? [filters[dataIndex]] : null,
        onFilter: (value: boolean | Key, record: PermissionData) => String(record[dataIndex] ?? "").toLowerCase().includes(String(value).toLowerCase()),
    });

    const columns: TableProps<PermissionData>["columns"] = [
        {
            title: "Action", dataIndex: "Action", key: "Action", ...searchColumn("Action"),
            render: (value, record) => <Space size={4}>
                <GoldenArrowAction tooltip="View permission details" ariaLabel={`View permission details for ${value}`}
                                   onClick={() => {
                                       selectRecord(record);
                                       setModalData(record);
                                   }}/>
                <span>{value}</span>
            </Space>
        },
        {
            title: "Description",
            dataIndex: "Description",
            key: "Description",
            render: (value: string | null) => value || "-", ...searchColumn("Description")
        },
    ];

    return <Card variant="borderless" styles={{body: {padding: 0}}}>
        <Breadcrumb style={{marginBottom: 16}}
                    items={[{title: "Home"}, {title: "System Administration"}, {title: "Permissions Setup"}]}/>
        <ToolbarWrapper><ButtonToolbar title="Refresh" icon={<ReloadOutlined/>}
                                       onClick={() => void dispatch(fetchPermissions())}/><ButtonToolbar title="Create"
                                                                                                         icon={
                                                                                                             <PlusOutlined/>}
                                                                                                         onClick={() => setIsCreateModalVisible(true)}/></ToolbarWrapper>
        <Table columns={columns} dataSource={data} size="small" loading={loading} rowKey="Id"
               onChange={(_, activeFilters) => setFilters({
                   Action: String(activeFilters.Action?.[0] ?? ""),
                   Description: String(activeFilters.Description?.[0] ?? "")
               })}
               onRow={(record) => ({onClick: () => selectRecord(record)})}
               rowClassName={(record) => isSelected(record) ? "ant-table-row-selected" : ""}
               pagination={{
                   size: "small",
                   pageSize: 100,
                   showSizeChanger: true,
                   hideOnSinglePage: true,
                   showTotal: (total) => `Total ${total} items`
               }} scroll={{x: "max-content", y: "calc(100vh - 380px)"}} className="small-table"
               style={{fontSize: "11px"}}/>
        <PermissionModal visible={modalData !== null} data={modalData} onClose={() => setModalData(null)}
                         onUpdated={() => void dispatch(fetchPermissions())} onDeleted={() => {
            clearSelection();
            setModalData(null);
            void dispatch(fetchPermissions());
        }}/>
        <CreatePermissionModal visible={isCreateModalVisible} onClose={() => setIsCreateModalVisible(false)}
                               onSuccess={() => void dispatch(fetchPermissions())}/>
    </Card>;
}
