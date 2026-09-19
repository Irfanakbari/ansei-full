"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {PlusOutlined, ReloadOutlined, SearchOutlined} from "@ant-design/icons";
import {Breadcrumb, Button, Card, Input, Space, Table, Tag} from "antd";
import type {InputRef, TableProps} from "antd";
import {useDispatch, useSelector} from "react-redux";
import ButtonToolbar from "@/components/ButtonToolbar";
import GoldenArrowAction from "@/components/GoldenArrowAction";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import {useSingleRowSelection} from "@/hooks/useSingleRowSelection";
import {formatDateTime} from "@/lib/utils/dateTime";
import {AppDispatch, RootState} from "@/store";
import {
    EmailNotificationEntity,
    fetchEmailNotifications,
    NotificationType,
    setEmailNotificationQuery
} from "@/store/features/settings/emailNotificationSlice";
import CreateEmailNotificationModal from "./_components/CreateEmailNotificationModal";
import EmailNotificationModal from "./_components/EmailNotificationModal";

const TYPE_COLORS: Record<NotificationType, string> = {
    DEFAULT: "default",
    INCOMING: "blue",
    OUTGOING: "green",
    PRODUCTION: "orange",
    TRANSFER: "purple"
};

export default function EmailConfigPage() {
    const dispatch = useDispatch<AppDispatch>();
    const {data, loading, query, pagination} = useSelector((state: RootState) => state.emailNotification);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [modalData, setModalData] = useState<EmailNotificationEntity | null>(null);
    const searchInput = useRef<InputRef>(null);
    const {selectRecord, clearSelection, isSelected} = useSingleRowSelection(data, (record) => record.Id);
    const refresh = useCallback(() => void dispatch(fetchEmailNotifications(query)), [dispatch, query]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const searchColumn = (dataIndex: "Name" | "Email" | "CreatedBy"): NonNullable<TableProps<EmailNotificationEntity>["columns"]>[number] => ({
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
        onFilter: (value, record) => {
            const fieldValue = dataIndex === "CreatedBy" ? record.CreatedByName || record.CreatedBy : record[dataIndex];
            return String(fieldValue ?? "").toLowerCase().includes(String(value).toLowerCase());
        },
    });

    const columns: TableProps<EmailNotificationEntity>["columns"] = [
        {
            title: "Name",
            dataIndex: "Name",
            key: "Name",
            ...searchColumn("Name"),
            render: (value, record) => (
                <Space size={4}>
                    <GoldenArrowAction tooltip="View email notification details"
                                       ariaLabel={`View email notification details for ${record.Name}`}
                                       onClick={() => {
                                           selectRecord(record);
                                           setModalData(record);
                                       }}/>
                    <span>{value}</span>
                </Space>
            )
        },
        {title: "Email", dataIndex: "Email", key: "Email", ellipsis: true, ...searchColumn("Email")},
        {
            title: "Type",
            dataIndex: "Type",
            key: "Type",
            align: "center",
            render: (value: NotificationType) => <Tag color={TYPE_COLORS[value]}>{value}</Tag>,
            filters: [
                {text: "Default", value: "DEFAULT"}, {text: "Incoming", value: "INCOMING"}, {
                    text: "Outgoing",
                    value: "OUTGOING"
                }, {text: "Production", value: "PRODUCTION"}, {text: "Transfer", value: "TRANSFER"},
            ],
            onFilter: (value, record) => record.Type === value
        },
        {
            title: "Created By",
            dataIndex: "CreatedBy",
            key: "CreatedBy",
            render: (_, record) => record.CreatedByName || record.CreatedBy || "-", ...searchColumn("CreatedBy")
        },
        {title: "Created At", dataIndex: "CreatedAt", key: "CreatedAt", render: formatDateTime},
    ];

    return (
        <Card variant="borderless" styles={{body: {padding: 0}}}>
            <Breadcrumb style={{marginBottom: 16}}
                        items={[{title: "Home"}, {title: "System Administration"}, {title: "Email Config"}]}/>
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined/>} onClick={refresh}/>
                <ButtonToolbar title="Create" icon={<PlusOutlined/>} onClick={() => setIsCreateModalVisible(true)}/>
            </ToolbarWrapper>
            <Table columns={columns} dataSource={data} size="small" loading={loading}
                   onChange={(pageInfo, filters) => {
                       const search = [filters.Name?.[0], filters.Email?.[0], filters.CreatedBy?.[0]].find((value) => typeof value === "string");
                       dispatch(setEmailNotificationQuery({
                           page: search !== undefined ? 1 : pageInfo.current,
                           limit: pageInfo.pageSize,
                           search: search === undefined ? undefined : String(search)
                       }));
                   }}
                   pagination={{
                       size: "small",
                       current: pagination.page,
                       pageSize: pagination.limit,
                       total: pagination.totalItems,
                       showSizeChanger: true,
                       showTotal: (total) => `Total ${total} records`
                   }}
                   rowKey="Id" onRow={(record) => ({onClick: () => selectRecord(record)})}
                   rowClassName={(record) => isSelected(record) ? "ant-table-row-selected" : ""}
                   scroll={{x: "max-content", y: "calc(100vh - 380px)"}} className="small-table"
                   style={{fontSize: 11}}/>
            <CreateEmailNotificationModal visible={isCreateModalVisible} onClose={() => setIsCreateModalVisible(false)}
                                          onSuccess={refresh}/>
            <EmailNotificationModal visible={modalData !== null} data={modalData} onClose={() => setModalData(null)}
                                    onUpdated={refresh} onDeleted={() => {
                clearSelection();
                setModalData(null);
                refresh();
            }}/>
        </Card>
    );
}
