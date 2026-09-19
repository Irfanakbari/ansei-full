"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {ApiOutlined, PlusOutlined, ReloadOutlined, SearchOutlined} from "@ant-design/icons";
import {Breadcrumb, Button, Card, Input, Space, Table, Tag} from "antd";
import type {InputRef, TableProps} from "antd";
import {useDispatch, useSelector} from "react-redux";
import ButtonToolbar from "@/components/ButtonToolbar";
import GoldenArrowAction from "@/components/GoldenArrowAction";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import {useSingleRowSelection} from "@/hooks/useSingleRowSelection";
import {AppDispatch, RootState} from "@/store";
import {fetchRoles, RoleData} from "@/store/features/roles/rolesSlice";
import AssignPermissionsModal from "./_components/AssignPermissionsModal";
import CreateRoleModal from "./_components/CreateRoleModal";
import RoleModal from "./_components/RoleModal";

export default function RolesConfigurationPage() {
    const dispatch = useDispatch<AppDispatch>();
    const {data, loading} = useSelector((state: RootState) => state.roles);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
    const [modalData, setModalData] = useState<RoleData | null>(null);
    const searchInput = useRef<InputRef>(null);
    const {
        selectedRecord,
        selectRecord,
        clearSelection,
        isSelected
    } = useSingleRowSelection(data, (record) => record.Id);

    const refresh = useCallback(() => void dispatch(fetchRoles()), [dispatch]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const searchColumn = (dataIndex: "RoleName" | "Description"): NonNullable<TableProps<RoleData>["columns"]>[number] => ({
        filterDropdown: ({setSelectedKeys, selectedKeys, confirm, clearFilters}) => (
            <div style={{padding: 8}} onKeyDown={(event) => event.stopPropagation()}>
                <Input ref={searchInput} placeholder={`Search ${dataIndex}`} value={String(selectedKeys[0] ?? "")}
                       onChange={(event) => setSelectedKeys(event.target.value ? [event.target.value] : [])}
                       onPressEnter={() => confirm()} style={{marginBottom: 8, display: "block"}}/>
                <Space>
                    <Button type="primary" onClick={() => confirm()} icon={<SearchOutlined/>} size="small"
                            style={{width: 90}}>Search</Button>
                    <Button onClick={() => {
                        clearFilters?.();
                        confirm();
                    }} size="small" style={{width: 90}}>Reset</Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered) => <SearchOutlined style={{color: filtered ? "#1677ff" : undefined}}/>,
        onFilter: (value, record) => String(record[dataIndex] ?? "").toLowerCase().includes(String(value).toLowerCase()),
    });

    const columns: TableProps<RoleData>["columns"] = [
        {
            title: "Role Name", dataIndex: "RoleName", key: "RoleName", ...searchColumn("RoleName"),
            render: (value, record) => <Space size={4}>
                <GoldenArrowAction tooltip="View role details" ariaLabel={`View role details for ${value}`}
                                   onClick={() => {
                                       selectRecord(record);
                                       setModalData(record);
                                   }}/>
                <span>{value}</span>
            </Space>
        },
        {title: "Description", dataIndex: "Description", key: "Description", ...searchColumn("Description")},
        {
            title: "Permissions", key: "Permissions", render: (_, record) => (
                <Space size={[0, 4]} wrap>
                    {record.Permission?.slice(0, 5).map((permission) => <Tag color="blue" key={permission.Id}
                                                                             style={{fontSize: 10}}>{permission.Action}</Tag>)}
                    {(record.Permission?.length ?? 0) > 5 &&
                        <Tag style={{fontSize: 10}}>+{(record.Permission?.length ?? 0) - 5} more</Tag>}
                </Space>
            )
        },
    ];

    return (
        <Card variant="borderless" styles={{body: {padding: 0}}}>
            <Breadcrumb style={{marginBottom: 16}}
                        items={[{title: "Home"}, {title: "System Administration"}, {title: "Roles Configuration"}]}/>
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined/>} onClick={refresh}/>
                <ButtonToolbar title="Create" icon={<PlusOutlined/>} onClick={() => setIsCreateModalVisible(true)}/>
                <ButtonToolbar title="Assign Permissions" icon={<ApiOutlined/>}
                               onClick={() => setIsAssignModalVisible(true)} enable={Boolean(selectedRecord)}/>
            </ToolbarWrapper>
            <Table columns={columns} dataSource={data} size="small" loading={loading} pagination={{
                size: "small",
                pageSize: 100,
                showSizeChanger: true,
                hideOnSinglePage: true,
                showTotal: (total) => `Total ${total} items`
            }}
                   rowKey="Id" onRow={(record) => ({
                onClick: () => selectRecord(record),
                onDoubleClick: () => {
                    selectRecord(record);
                    setModalData(record);
                },
            })}
                   rowClassName={(record) => isSelected(record) ? "ant-table-row-selected" : ""}
                   scroll={{x: "max-content", y: "calc(100vh - 380px)"}} className="small-table"
                   style={{fontSize: 11}}/>
            <CreateRoleModal visible={isCreateModalVisible} onClose={() => setIsCreateModalVisible(false)}/>
            <RoleModal visible={modalData !== null} data={modalData} onClose={() => setModalData(null)}
                       onUpdated={refresh} onDeleted={() => {
                clearSelection();
                setModalData(null);
                refresh();
            }}/>
            <AssignPermissionsModal visible={isAssignModalVisible} onClose={() => setIsAssignModalVisible(false)}
                                    role={selectedRecord ?? null}/>
        </Card>
    );
}
