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
import {fetchUsers, UserManagementEntity} from "@/store/features/users/usersSlice";
import {formatDateTime} from "@/lib/utils/dateTime";
import CreateUserModal from "./_components/CreateUserModal";
import UserModal from "./_components/UserModal";

export default function UserAccountsPage() {
    const dispatch = useDispatch<AppDispatch>();
    const {data, loading, pagination} = useSelector((state: RootState) => state.users);
    const [query, setQuery] = useState({page: 1, limit: 50, search: ""});
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [modalData, setModalData] = useState<UserManagementEntity | null>(null);
    const searchInput = useRef<InputRef>(null);
    const {selectRecord, clearSelection, isSelected} = useSingleRowSelection(data, (record) => record.Id);

    useEffect(() => {
        void dispatch(fetchUsers(query));
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

    const columns: TableProps<UserManagementEntity>["columns"] = [
        {
            title: "User ID", dataIndex: "UserId", key: "UserId", ...searchColumn("Search User ID"),
            render: (value, record) => <Space size={4}>
                <GoldenArrowAction tooltip="View user details" ariaLabel={`View user details for ${value}`}
                                   onClick={() => {
                                       selectRecord(record);
                                       setModalData(record);
                                   }}/>
                <span>{value}</span>
            </Space>
        },
        {title: "Name", dataIndex: "Name", key: "Name", ...searchColumn("Search Name")},
        {title: "Email", dataIndex: "Email", key: "Email", ...searchColumn("Search Email")},
        {
            title: "Is Active",
            dataIndex: "IsActive",
            key: "IsActive",
            render: (value: boolean) => <Tag color={value ? "green" : "red"}>{value ? "Active" : "Inactive"}</Tag>
        },
        {title: "Role", dataIndex: "RoleId", key: "RoleId", render: (_, record) => record.Role?.RoleName || "-"},
        {
            title: "Last Login",
            dataIndex: "LastLogin",
            key: "LastLogin",
            render: (value: string | null) => formatDateTime(value)
        },
        {title: "Created Date", dataIndex: "CreatedAt", key: "CreatedAt", render: formatDateTime},
        {
            title: "Created By",
            dataIndex: "CreatedBy",
            key: "CreatedBy",
            render: (_, record) => record.CreatedByName || record.CreatedBy || "-"
        },
        {title: "Updated Date", dataIndex: "UpdatedAt", key: "UpdatedAt", render: formatDateTime},
        {
            title: "Updated By",
            dataIndex: "UpdatedBy",
            key: "UpdatedBy",
            render: (_, record) => record.UpdatedByName || record.UpdatedBy || "-"
        },
    ];

    return <Card variant="borderless" styles={{body: {padding: 0}}}>
        <Breadcrumb style={{marginBottom: 16}}
                    items={[{title: "Home"}, {title: "System Administration"}, {title: "User Accounts"}]}/>
        <ToolbarWrapper><ButtonToolbar title="Refresh" icon={<ReloadOutlined/>}
                                       onClick={() => void dispatch(fetchUsers(query))}/><ButtonToolbar title="Create"
                                                                                                        icon={
                                                                                                            <PlusOutlined/>}
                                                                                                        onClick={() => setIsCreateModalVisible(true)}/></ToolbarWrapper>
        <Table columns={columns} dataSource={data} size="small" loading={loading} rowKey="Id"
               onChange={(pageInfo, filters) => {
                   const search = String(filters.UserId?.[0] ?? filters.Name?.[0] ?? filters.Email?.[0] ?? "");
                   setQuery((current) => ({
                       page: search !== current.search ? 1 : pageInfo.current ?? 1,
                       limit: pageInfo.pageSize ?? 50,
                       search
                   }));
               }}
               onRow={(record) => ({
                   onClick: () => selectRecord(record),
                   onDoubleClick: () => {
                       selectRecord(record);
                       setModalData(record);
                   },
               })}
               rowClassName={(record) => isSelected(record) ? "ant-table-row-selected" : ""}
               pagination={{
                   size: "small",
                   current: pagination.page,
                   pageSize: pagination.limit,
                   total: pagination.totalItems,
                   showSizeChanger: true,
                   hideOnSinglePage: true,
                   showTotal: (total) => `Total ${total} items`
               }}
               scroll={{x: "max-content", y: "calc(100vh - 380px)"}} className="small-table"
               style={{fontSize: "11px"}}/>
        <UserModal visible={modalData !== null} data={modalData} onClose={() => setModalData(null)}
                   onUpdated={() => void dispatch(fetchUsers(query))} onDeleted={() => {
            clearSelection();
            setModalData(null);
            void dispatch(fetchUsers(query));
        }}/>
        <CreateUserModal visible={isCreateModalVisible} onClose={() => setIsCreateModalVisible(false)}
                         onSuccess={() => void dispatch(fetchUsers(query))}/>
    </Card>;
}
