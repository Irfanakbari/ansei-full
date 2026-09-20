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
    DisplayConfigEntity,
    fetchDisplayConfig,
    setDisplayConfigQuery
} from "@/store/features/settings/displayConfig/displayConfigSlice";
import CreateEditDisplayConfigModal from "./_components/CreateEditDisplayConfigModal";
import DisplayConfigModal from "./_components/DisplayConfigModal";

export default function DisplayConfigPage() {
    const dispatch = useDispatch<AppDispatch>();
    const {data, loading, query, pagination} = useSelector((state: RootState) => state.displayConfig);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [modalData, setModalData] = useState<DisplayConfigEntity | null>(null);
    const searchInput = useRef<InputRef>(null);
    const {selectRecord, clearSelection, isSelected} = useSingleRowSelection(data, (record) => record.Id);
    const refresh = useCallback(() => void dispatch(fetchDisplayConfig(query)), [dispatch, query]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const columns: TableProps<DisplayConfigEntity>["columns"] = [
        {
            title: "Description",
            dataIndex: "Description",
            key: "Description",
            filterDropdown: ({setSelectedKeys, selectedKeys, confirm, clearFilters}) => (
                <div style={{padding: 8}} onKeyDown={(event) => event.stopPropagation()}>
                    <Input ref={searchInput} placeholder="Search Description" value={String(selectedKeys[0] ?? "")}
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
            filteredValue: query.search ? [query.search] : null,
            render: (value, record) => (
                <Space size={4}>
                    <GoldenArrowAction tooltip="View display config details"
                                       ariaLabel={`View display config details for ${record.Description}`}
                                       onClick={() => {
                                           selectRecord(record);
                                           setModalData(record);
                                       }}/>
                    <span>{value}</span>
                </Space>
            )
        },
        {title: "URL", dataIndex: "Url", key: "Url", ellipsis: true},
        {
            title: "Auto Open",
            dataIndex: "IsOpen",
            key: "IsOpen",
            align: "center",
            render: (value: boolean) => <Tag color={value ? "green" : "default"}>{value ? "Yes" : "No"}</Tag>
        },
        {
            title: "Loop",
            dataIndex: "Loop",
            key: "Loop",
            align: "center",
            render: (value: boolean) => <Tag color={value ? "green" : "default"}>{value ? "Yes" : "No"}</Tag>
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

    return (
        <Card variant="borderless" styles={{body: {padding: 0}}}>
            <Breadcrumb style={{marginBottom: 16}}
                        items={[{title: "Home"}, {title: "System Administration"}, {title: "Display Config"}]}/>
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined/>} onClick={refresh}/>
                <ButtonToolbar title="Create" icon={<PlusOutlined/>} onClick={() => setIsCreateModalVisible(true)}/>
            </ToolbarWrapper>
            <Table columns={columns} dataSource={data} size="small" loading={loading}
                   onChange={(pageInfo, filters) => dispatch(setDisplayConfigQuery({
                       page: filters.Description ? 1 : pageInfo.current,
                       limit: pageInfo.pageSize,
                       search: String(filters.Description?.[0] ?? "")
                   }))}
                   pagination={{
                       size: "small",
                       current: pagination.page,
                       pageSize: pagination.limit,
                       total: pagination.totalItems,
                       showSizeChanger: true,
                       showTotal: (total) => `Total ${total} records`
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
            <CreateEditDisplayConfigModal visible={isCreateModalVisible} onClose={() => setIsCreateModalVisible(false)}
                                          onSuccess={refresh} data={null}/>
            <DisplayConfigModal visible={modalData !== null} data={modalData} onClose={() => setModalData(null)}
                                onUpdated={refresh} onDeleted={() => {
                clearSelection();
                setModalData(null);
                refresh();
            }}/>
        </Card>
    );
}
