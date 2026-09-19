"use client";

import {useEffect, useRef, useState} from "react";
import {PlusOutlined, ReloadOutlined, SearchOutlined} from "@ant-design/icons";
import {Breadcrumb, Button, Card, Input, Space, Table} from "antd";
import type {InputRef, TableProps} from "antd";
import {useDispatch, useSelector} from "react-redux";
import ButtonToolbar from "@/components/ButtonToolbar";
import GoldenArrowAction from "@/components/GoldenArrowAction";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import {useSingleRowSelection} from "@/hooks/useSingleRowSelection";
import {AppDispatch, RootState} from "@/store";
import {BoxQTYEntity, fetchBoxQTY, setBoxQTYQuery} from "@/store/features/master/boxQtySlice";
import BoxQTYModal from "./_components/BoxQTYModal";
import CreateBoxQTYModal from "./_components/CreateBoxQTYModal";

export default function BoxQTYPage() {
    const dispatch = useDispatch<AppDispatch>();
    const {data, loading, pagination, query} = useSelector((state: RootState) => state.boxQTY);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [modalData, setModalData] = useState<BoxQTYEntity | null>(null);
    const searchInput = useRef<InputRef>(null);
    const {selectRecord, clearSelection, isSelected} = useSingleRowSelection(data, (record) => record.Id);

    useEffect(() => {
        void dispatch(fetchBoxQTY(query));
    }, [dispatch, query]);

    const columns: TableProps<BoxQTYEntity>["columns"] = [
        {
            title: "Part Number",
            dataIndex: "PartNumber",
            key: "PartNumber",
            filterDropdown: ({setSelectedKeys, selectedKeys, confirm, clearFilters}) => (
                <div style={{padding: 8}} onKeyDown={(event) => event.stopPropagation()}>
                    <Input ref={searchInput} placeholder="Search PartNumber" value={String(selectedKeys[0] ?? "")}
                           onChange={(event) => setSelectedKeys(event.target.value ? [event.target.value] : [])}
                           onPressEnter={() => confirm()} style={{marginBottom: 8, display: "block"}}/>
                    <Space><Button type="primary" onClick={() => confirm()} icon={<SearchOutlined/>} size="small"
                                   style={{width: 90}}>Search</Button><Button onClick={() => {
                        clearFilters?.();
                        confirm();
                    }} size="small" style={{width: 90}}>Reset</Button></Space>
                </div>
            ),
            filterIcon: (filtered) => <SearchOutlined style={{color: filtered ? "#1677ff" : undefined}}/>,
            filteredValue: query.search ? [query.search] : null,
            render: (value, record) => <Space size={4}>
                <GoldenArrowAction tooltip="View box QTY details" ariaLabel={`View box QTY details for ${value}`} onClick={() => {
                    selectRecord(record);
                    setModalData(record);
                }}/>
                <span>{value}</span>
            </Space>
        },
        {
            title: "Finish Good",
            dataIndex: ["PartData", "PartName"],
            key: "PartData",
            render: (_, record) => record.PartData?.PartName || "-"
        },
        {title: "Qty Per Box", dataIndex: "Qty", key: "Qty"},
    ];

    return (
        <Card variant="borderless" styles={{body: {padding: 0}}}>
            <Breadcrumb style={{marginBottom: 16}}
                        items={[{title: "Home"}, {title: "Master Data"}, {title: "Box QTY"}]}/>
            <ToolbarWrapper><ButtonToolbar title="Refresh" icon={<ReloadOutlined/>}
                                           onClick={() => void dispatch(fetchBoxQTY(query))}/><ButtonToolbar
                title="Create" icon={<PlusOutlined/>} onClick={() => setIsCreateModalVisible(true)}/></ToolbarWrapper>
            <Table columns={columns} dataSource={data} size="small" loading={loading}
                   onChange={(pageInfo, filters) => dispatch(setBoxQTYQuery({
                       page: filters.PartNumber ? 1 : pageInfo.current,
                       limit: pageInfo.pageSize,
                       search: String(filters.PartNumber?.[0] ?? "")
                   }))} pagination={{
                size: "small",
                current: pagination.page,
                pageSize: pagination.limit,
                total: pagination.totalItems,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} items`
            }} rowKey="Id" onRow={(record) => ({onClick: () => selectRecord(record)})}
                   rowClassName={(record) => isSelected(record) ? "ant-table-row-selected" : ""}
                   scroll={{x: "max-content", y: "calc(100vh - 380px)"}} className="small-table"
                   style={{fontSize: "11px"}}/>
            <BoxQTYModal visible={modalData !== null} data={modalData} onClose={() => setModalData(null)}
                         onUpdated={() => void dispatch(fetchBoxQTY(query))} onDeleted={() => {
                clearSelection();
                setModalData(null);
                void dispatch(fetchBoxQTY(query));
            }}/>
            <CreateBoxQTYModal visible={isCreateModalVisible} onClose={() => setIsCreateModalVisible(false)}
                               onSuccess={() => void dispatch(fetchBoxQTY(query))}/>
        </Card>
    );
}
