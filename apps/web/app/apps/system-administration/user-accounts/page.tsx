/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useState, useEffect } from 'react';
import { Table, Card, Breadcrumb, App, Input, Tag } from 'antd';
import { EditOutlined, DeleteOutlined, ReloadOutlined, ExclamationCircleOutlined, PlusOutlined } from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { UserManagementEntity, fetchUsers, deleteUser } from '@/store/features/users/usersSlice';
import CreateUserModal from './_components/CreateUserModal';
import EditUserModal from './_components/EditUserModal';
import { formatDateTime } from '@/lib/utils/dateTime';

export default function UserAccountsPage() {
    const { message, modal } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const { data, loading, pagination } = useSelector((state: RootState) => state.users);
    const [query, setQuery] = useState({ page: 1, limit: 50, search: '' });
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editData, setEditData] = useState<UserManagementEntity | null>(null);

    useEffect(() => {
        dispatch(fetchUsers(query));
    }, [dispatch, query]);

    const columns = [
        {
            title: 'User ID',
            dataIndex: 'UserId',
            key: 'UserId',
        },
        {
            title: 'Name',
            dataIndex: 'Name',
            key: 'Name',
        },
        {
            title: 'Email',
            dataIndex: 'Email',
            key: 'Email',
        },
        {
            title: 'Is Active',
            dataIndex: 'IsActive',
            key: 'IsActive',
            render: (val: boolean) => <Tag color={val ? 'green' : 'red'}>{val ? 'Active' : 'Inactive'}</Tag>
        },
        {
            title: 'Role ID',
            dataIndex: 'RoleId',
            key: 'RoleId',
            render: (val: number | null) => val ?? '-'
        },
        {
            title: 'Last Login',
            dataIndex: 'LastLogin',
            key: 'LastLogin',
            render: (val: string | null) => formatDateTime(val)
        }
    ];

    const handleEdit = () => {
        if (selectedRowKeys.length === 1) {
            const selectedRecord = data.find((item) => item.Id === selectedRowKeys[0]);
            if (selectedRecord) {
                setEditData(selectedRecord);
                setIsEditModalVisible(true);
            }
        }
    };

    const handleDelete = () => {
        if (selectedRowKeys.length === 1) {
            modal.confirm({
                title: 'Are you sure you want to delete this User?',
                icon: <ExclamationCircleOutlined />,
                content: `User Name: ${data.find(d => d.Id === selectedRowKeys[0])?.Name}`,
                okText: 'Yes, Delete',
                okType: 'danger',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        const result = await dispatch(deleteUser(selectedRowKeys[0] as string));

                        if (deleteUser.rejected.match(result)) {
                            throw new Error((result.payload as string) || 'Failed to delete user');
                        }
                        message.success('User successfully deleted');
                        setSelectedRowKeys([]);
                        dispatch(fetchUsers(query));
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || String(error) || 'Failed to delete User');
                    }
                },
            });
        }
    };

    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb style={{ marginBottom: 16 }} items={[{ title: 'Home' }, { title: 'System Administration' }, { title: 'User Accounts' }]} />
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined />} onClick={() => { dispatch(fetchUsers(query)); }} />
                <ButtonToolbar title="Create" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)} />
                <ButtonToolbar title="Edit" icon={<EditOutlined />} onClick={handleEdit} enable={selectedRowKeys.length === 1} />
                <ButtonToolbar title="Delete" icon={<DeleteOutlined />} onClick={handleDelete} enable={selectedRowKeys.length === 1} />
            </ToolbarWrapper>
            <Input.Search allowClear placeholder="Search user ID, name, email, or phone" style={{ width: 360, marginBottom: 12 }} onSearch={(search) => setQuery((current) => ({ ...current, page: 1, search }))} />

            <Table
                rowSelection={{
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys),
                    checkStrictly: true,
                    type: 'radio',
                }}
                columns={columns}
                dataSource={data}
                size="small"
                loading={loading}
                pagination={{
                    size: 'small',
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    showSizeChanger: true,
                    hideOnSinglePage: true,
                    showTotal: (total) => `Total ${total} items`,
                }}
                onChange={(pageConfig) => setQuery((current) => ({ ...current, page: pageConfig.current ?? 1, limit: pageConfig.pageSize ?? 50 }))}
                rowKey="Id"
                scroll={{ y: 'calc(100vh - 360px)' }}
                className="small-table"
                style={{ fontSize: '11px' }}
            />

            {editData && (
                <EditUserModal
                    visible={isEditModalVisible}
                    onClose={() => setIsEditModalVisible(false)}
                    data={editData}
                />
            )}

            <CreateUserModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
            />
        </Card>
    );
}
