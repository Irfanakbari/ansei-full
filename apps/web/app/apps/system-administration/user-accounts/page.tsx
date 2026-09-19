/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Table, Card, Breadcrumb, App, Input, Tag, Space, Button } from 'antd';
import type { InputRef, TableProps } from 'antd';
import { EditOutlined, DeleteOutlined, ReloadOutlined, ExclamationCircleOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
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

    const searchInput = useRef<InputRef>(null);

    useEffect(() => {
        dispatch(fetchUsers(query));
    }, [dispatch, query]);

    const getColumnSearchProps = (dataIndex: string) => ({
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
            <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
                <Input
                    ref={searchInput}
                    placeholder={`Search ${dataIndex}`}
                    value={selectedKeys[0]}
                    onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                    onPressEnter={() => confirm()}
                    style={{ marginBottom: 8, display: 'block' }}
                />
                <Space>
                    <Button type="primary" onClick={() => confirm()} icon={<SearchOutlined />} size="small" style={{ width: 90 }}>
                        Search
                    </Button>
                    <Button onClick={() => { if (clearFilters) clearFilters(); confirm(); }} size="small" style={{ width: 90 }}>
                        Reset
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered: boolean) => (
            <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
        ),
    });

    const columns = [
        {
            title: 'User ID',
            dataIndex: 'UserId',
            key: 'UserId',
            ...getColumnSearchProps('UserId'),
        },
        {
            title: 'Name',
            dataIndex: 'Name',
            key: 'Name',
            ...getColumnSearchProps('Name'),
        },
        {
            title: 'Email',
            dataIndex: 'Email',
            key: 'Email',
            ...getColumnSearchProps('Email'),
        },
        {
            title: 'Is Active',
            dataIndex: 'IsActive',
            key: 'IsActive',
            render: (val: boolean) => <Tag color={val ? 'green' : 'red'}>{val ? 'Active' : 'Inactive'}</Tag>
        },
        {
            title: 'Role',
            dataIndex: 'RoleId',
            key: 'RoleId',
            render: (_: any, record: UserManagementEntity) => record.Role?.RoleName || record.RoleId || '-'
        },
        {
            title: 'Last Login',
            dataIndex: 'LastLogin',
            key: 'LastLogin',
            render: (val: string | null) => formatDateTime(val)
        }
    ];

    const handleTableChange: TableProps<UserManagementEntity>['onChange'] = (pageConfig, filters) => {
        const search = String(filters.UserId?.[0] ?? filters.Name?.[0] ?? filters.Email?.[0] ?? '');
        setQuery((current) => ({
            ...current,
            page: search !== query.search ? 1 : (pageConfig.current ?? 1),
            limit: pageConfig.pageSize ?? 50,
            search,
        }));
    };

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
            const selectedRecord = data.find(d => d.Id === selectedRowKeys[0]);
            modal.confirm({
                title: 'Are you sure you want to delete this User?',
                icon: <ExclamationCircleOutlined />,
                content: `User Name: ${selectedRecord?.Name}`,
                okText: 'Yes, Delete',
                okType: 'danger',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        const targetId = selectedRecord?.UserId || (selectedRowKeys[0] as string);
                        const result = await dispatch(deleteUser(targetId));

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
                onChange={handleTableChange}
                rowKey="Id"
                scroll={{ x: 'max-content', y: 'calc(100vh - 380px)' }}
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
