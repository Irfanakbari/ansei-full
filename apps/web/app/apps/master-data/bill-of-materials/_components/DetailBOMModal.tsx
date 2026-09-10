/*By Irfan Akbari Vuteq Indonesia - 2026-07*/
import React from 'react';
import { Modal, Table, Typography } from 'antd';
import { BOMGrouped } from '@/store/features/master/bomSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    data: BOMGrouped;
}

const { Title } = Typography;

const DetailBOMModal: React.FC<Props> = ({ visible, onClose, data }) => {
    const columns = [
        {
            title: '#',
            key: 'index',
            width: 50,
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Part Number',
            dataIndex: ['MaterialData', 'PartNumber'],
            key: 'PartNumber',
            width: 150,
            render: (val: string) => <code style={{ fontSize: 11 }}>{val}</code>,
        },
        {
            title: 'Part Name',
            dataIndex: ['MaterialData', 'PartName'],
            key: 'PartName',
        },
        {
            title: 'Qty',
            dataIndex: 'Qty',
            key: 'Qty',
            width: 100,
            align: 'right' as const,
        },
    ];

    return (
        <Modal
            title={`Detail BOM - ${data.FGData.PartNumber} (${data.FGData.PartName})`}
            open={visible}
            onOk={onClose}
            centered={true}
            onCancel={onClose}
            width={700}
            zIndex={1050}
        >
            <Title level={5} style={{ marginBottom: 8 }}>
                Materials ({data.materials.length})
            </Title>
            <Table
                dataSource={data.materials}
                columns={columns}
                rowKey="Id"
                size="small"
                pagination={false}
                scroll={{ y: 400 }}
                style={{ fontSize: '11px' }}
            />
        </Modal>
    );
};

export default DetailBOMModal;
