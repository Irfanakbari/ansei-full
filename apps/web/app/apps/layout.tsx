/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 - Updated 2026-06-18 - Original Theme with Font Improvements */

"use client";

import React, { useState } from 'react';
import {
    PieChartOutlined,
    UserOutlined,
    SettingOutlined,
    DatabaseOutlined,
    InboxOutlined,
    ShopOutlined,
    BellOutlined,
    FileTextOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import Image from 'next/image';
import { Layout, Menu, Avatar, Space, Dropdown, Modal, Table, Tag, Badge } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '@/store';
import { checkAuthStatus, setAuthData, clearAuth, logoutUser } from '@/store/features/auth/authSlice';
import { fetchSessions, MTCUserSession } from '@/store/features/auth/sessionSlice';
import { fetchNotifications } from '@/store/features/notifications/notificationsSlice';
import '../batik.css';
import { LockOutlined } from '@ant-design/icons';

const { Header, Content, Footer, Sider } = Layout;

const LoadingOverlay = () => (
    <div className="glass-loader-container">
        <div className="loader-content">
            <div className="spinner-box">
                <div className="circle-border">
                    <div className="circle-core"></div>
                </div>
            </div>
            <div className="loader-text">Verifying Session...</div>
        </div>
    </div>
);

type MenuItem = Required<MenuProps>['items'][number] & {
    permission?: string[];
};

function getItem(
    label: React.ReactNode,
    key: React.Key,
    icon?: React.ReactNode,
    children?: MenuItem[],
    permission?: string[],
): MenuItem {
    return {
        key,
        icon,
        children,
        label,
        permission
    } as MenuItem;
}

const items: MenuItem[] = [
    getItem(<Link href="/apps">Dashboard</Link>, 'dashboard', <PieChartOutlined />),
    getItem('Master Data', 'master-data', <DatabaseOutlined />, [
        getItem(<Link href="/apps/master-data/satuan">Unit</Link>, 'md-satuan'),
        getItem(<Link href="/apps/master-data/supplier">Supplier</Link>, 'md-supplier'),
        getItem(<Link href="/apps/master-data/material">Material</Link>, 'md-material'),
        getItem(<Link href="/apps/master-data/finish-good">Finish Good</Link>, 'md-finish-good'),
        getItem(<Link href="/apps/master-data/bill-of-materials">Bill of Materials</Link>, 'md-bom'),
        getItem(<Link href="/apps/master-data/box-qty">Box QTY</Link>, 'md-box-qty'),
        getItem(<Link href="/apps/master-data/man-power">Man Power</Link>, 'md-man-power'),
    ]),
    getItem('Warehouse', 'warehouse', <InboxOutlined />, [
        getItem(<Link href="/apps/warehouse/incoming">Incoming Warehouse</Link>, 'wh-incoming'),
        getItem(<Link href="/apps/warehouse/transfer">Transfer to Rack</Link>, 'wh-transfer'),
        getItem(<Link href="/apps/warehouse/mrp">Material Run-out</Link>, 'wh-mrp'),
        getItem(<Link href="/apps/warehouse/inventory-counting">Inventory Counting</Link>, 'wh-inventory-counting'),
        getItem(<Link href="/apps/warehouse/transfer-material">Transfer Material</Link>, 'wh-transfer-material'),
    ]),
    getItem('Production', 'production', <ShopOutlined />, [
        getItem(<Link href="/apps/production/forecast">Forecast</Link>, 'prod-forecast'),
        getItem(<Link href="/apps/production/production-release">Production Release</Link>, 'prod-release'),
        getItem('Process', 'production-process', <ShopOutlined />, [
            getItem(<Link href="/apps/production/shopping">Shopping</Link>, 'prod-shopping'),
            getItem(<Link href="/apps/production/pre-delivery">Pre Delivery Goods</Link>, 'prod-pre-delivery'),
            getItem(<Link href="/apps/production/pokayoke">Pokayoke Validation</Link>, 'prod-pokayoke'),
            getItem(<Link href="/apps/production/delivery">Delivery</Link>, 'prod-delivery'),
        ]),
        getItem(<Link href="/apps/production/production-report">Production Report</Link>, 'prod-production-report'),
    ]),
    getItem('System Administration', 'system-administration', <SettingOutlined />, [
        getItem(<Link href="/apps/system-administration/user-accounts">User Accounts</Link>, 'sa-user-accounts', undefined, undefined, ['USER_MANAGEMENT']),
        getItem(<Link href="/apps/system-administration/roles-configuration">Roles Configuration</Link>, 'sa-roles-configuration', undefined, undefined, ['USER_MANAGEMENT']),
        getItem(<Link href="/apps/system-administration/api-key-management">API Key Management</Link>, 'sa-api-key-management'),
        getItem(<Link href="/apps/system-administration/permissions-setup">Permissions Setup</Link>, 'sa-permissions-setup', undefined, undefined, ['USER_MANAGEMENT']),
        getItem(<Link href="/apps/system-administration/system-log">System Logs</Link>, 'sa-system-logs'),
        getItem(<Link href="/apps/system-administration/stock-transaction-log">Stock Transaction Log</Link>, 'sa-stock-transaction-log'),
        getItem(<Link href="/apps/system-administration/printer-config">Printer Config</Link>, 'sa-printer-config'),
        getItem(<Link href="/apps/system-administration/email-config">Email Config</Link>, 'sa-email-config'),
        getItem(<Link href="/apps/system-administration/display-config">Display Config</Link>, 'sa-display-config'),
    ]),
    getItem(<Link href="/apps/report">Reports</Link>, 'reports', <FileTextOutlined />),
];

const applyPermission = (
    menus: MenuItem[],
    permissions: string[],
    roleName?: string
): MenuItem[] => {
    const isSuper = roleName === "SUPER";

    return menus.map((menu) => {
        if (!menu || (menu as any).type === 'divider') {
            return menu;
        }

        const menuItem = menu as any;

        const hasPermission =
            isSuper ||
            !menuItem.permission ||
            menuItem.permission.some((p: string) => permissions.includes(p));

        let newLabel = menuItem.label;

        if (!hasPermission) {
            newLabel = (
                <span style={{ opacity: 0.6 }}>
                    {menuItem.label} <LockOutlined />
                </span>
            );
        }

        if (menuItem.children) {
            return {
                ...menuItem,
                children: applyPermission(menuItem.children as MenuItem[], permissions, roleName),
                label: newLabel,
            };
        }

        return {
            ...menuItem,
            label: newLabel,
            disabled: !hasPermission,
        };
    });
};

const AppLayout = ({ children }: { children: React.ReactNode }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [sessionModalVisible, setSessionModalVisible] = useState(false);
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const { data: session, status } = useSession();
    const { user } = useSelector((state: RootState) => state.auth);
    const { sessions, loading: sessionLoading } = useSelector((state: RootState) => state.sessions);
    const { data: notifications } = useSelector((state: RootState) => state.notifications);
    const [isChecking, setIsChecking] = useState(true);

    const handleOpenSessionModal = () => {
        dispatch(fetchSessions());
        setSessionModalVisible(true);
    };

    const handleCloseSessionModal = () => {
        setSessionModalVisible(false);
    };

    const sessionColumns: ColumnsType<MTCUserSession> = [
        {
            title: 'Session ID',
            dataIndex: 'SessionId',
            key: 'SessionId',
            ellipsis: true,
            render: (val: string) => <span style={{ fontSize: 13 }}>{val}</span>,
        },
        {
            title: 'IP Address',
            dataIndex: 'IpAddress',
            key: 'IpAddress',
            render: (val: string) => <span style={{ fontSize: 13 }}>{val}</span>,
        },
        {
            title: 'User Agent',
            dataIndex: 'UserAgent',
            key: 'UserAgent',
            ellipsis: true,
            render: (val: string) => <span style={{ fontSize: 13 }}>{val}</span>,
        },
        {
            title: 'Status',
            dataIndex: 'IsActive',
            key: 'IsActive',
            render: (isActive: boolean) => (
                <Tag color={isActive ? 'green' : 'red'} style={{ fontSize: 12 }}>
                    {isActive ? 'Active' : 'Inactive'}
                </Tag>
            ),
        },
        {
            title: 'Created At',
            dataIndex: 'CreatedAt',
            key: 'CreatedAt',
            render: (val: string) => <span style={{ fontSize: 13 }}>{new Date(val).toLocaleString('id-ID')}</span>,
        },
        {
            title: 'Expires At',
            dataIndex: 'ExpiresAt',
            key: 'ExpiresAt',
            render: (val: string) => <span style={{ fontSize: 13 }}>{new Date(val).toLocaleString('id-ID')}</span>,
        },
    ];

    React.useEffect(() => {
        const checkAuth = async () => {
            if (status === 'loading') return;

            const isProcessing401 = typeof window !== 'undefined' && sessionStorage.getItem('processing401') === 'true';
            if (isProcessing401) {
                return;
            }

            const extendedSession = session as { accessToken?: string; user?: any };
            if (status === 'authenticated' && extendedSession?.accessToken) {
                dispatch(setAuthData({
                    user: extendedSession.user,
                    token: extendedSession.accessToken
                }));
                setIsChecking(false);
                return;
            }

            const resultAction = await dispatch(checkAuthStatus());
            if (checkAuthStatus.fulfilled.match(resultAction)) {
                setIsChecking(false);
            } else {
                router.push('/');
            }
        };

        checkAuth();
    }, [status, session, dispatch, router]);

    React.useEffect(() => {
        if (!isChecking) {
            dispatch(fetchNotifications());
            const intervalId = setInterval(() => {
                dispatch(fetchNotifications());
            }, 20000);
            return () => clearInterval(intervalId);
        }
    }, [isChecking, dispatch]);

    const handleLogout = async () => {
        dispatch(clearAuth());
        try {
            const result = await dispatch(logoutUser());
            if (logoutUser.rejected.match(result)) {
                console.error('Failed to logout:', result.payload);
            }
        } catch (error) {
            console.error('Failed to logout:', error);
        }
        signOut({ callbackUrl: '/' });
    };

    const userMenu: MenuProps['items'] = [
        {
            key: '1',
            label: (
                <span onClick={handleOpenSessionModal}>
                    Session Management
                </span>
            ),
        },
        {
            key: '2',
            label: (
                <span onClick={handleLogout}>
                    Logout
                </span>
            ),
        },
    ];

    const menuWithPermission = React.useMemo(() => {
        const menus = applyPermission(items, user?.Permission || [], user?.RoleName);

        const addBadges = (menuList: MenuItem[]): MenuItem[] => {
            return menuList.map((menu) => {
                if (!menu || (menu as any).type === 'divider') return menu;

                const m = menu as any;
                let label = m.label;

                if (m.key === 'wh-incoming' && notifications?.totalIncomingNotClosed && notifications.totalIncomingNotClosed > 0) {
                    label = (
                        <Space>
                            {m.label}
                            <Badge count={notifications.totalIncomingNotClosed} size="small" />
                        </Space>
                    );
                }

                if (m.key === 'prod-release' && notifications?.totalPOWithoutAttachment && notifications.totalPOWithoutAttachment > 0) {
                    label = (
                        <Space>
                            {m.label}
                            <Badge count={notifications.totalPOWithoutAttachment} size="small" />
                        </Space>
                    );
                }

                if (m.key === 'wh-inventory-counting' && notifications?.totalStockOpnameInProgress && notifications.totalStockOpnameInProgress > 0) {
                    label = (
                        <Space>
                            {m.label}
                            <Badge count={notifications.totalStockOpnameInProgress} size="small" />
                        </Space>
                    );
                }

                if (m.key === 'prod-pre-delivery' && notifications?.totalLabelDataNotScanned && notifications.totalLabelDataNotScanned > 0) {
                    label = (
                        <Space>
                            {m.label}
                            <Badge count={notifications.totalLabelDataNotScanned} size="small" />
                        </Space>
                    );
                }

                if (m.children) {
                    return {
                        ...m,
                        children: addBadges(m.children as MenuItem[]),
                        label,
                    };
                }

                return { ...m, label };
            });
        };

        return addBadges(menus);
    }, [user, notifications]);

    return (
        <>
            {isChecking && <LoadingOverlay />}
            <Layout style={{ minHeight: '100vh' }}>
                {/* Sidebar - Original Theme */}
                <Sider
                    collapsible
                    collapsed={collapsed}
                    onCollapse={(value) => setCollapsed(value)}
                    width={300}
                    collapsedWidth={80}
                    theme="dark"
                    style={{
                        overflow: 'auto',
                        height: '100vh',
                        position: 'fixed',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        zIndex: 1001,
                    }}
                >
                    <div className={'text-center justify-center flex p-5'}>
                        <Image src="/images/ftr.png" alt="Logo" width={120} height={120} />
                    </div>
                    <Menu
                        theme="dark"
                        defaultSelectedKeys={['dashboard']}
                        mode="inline"
                        items={menuWithPermission}
                    />
                </Sider>

                {/* Main Content Area */}
                <Layout style={{ marginLeft: collapsed ? 80 : 300, transition: 'margin-left 0.2s' }}>
                    {/* Header - Original Theme */}
                    <Header className="batik-bg" style={{ padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1000, width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'left' }}>
                            <h4 className="text-xl font-semibold ml-1 text-white">IPCS - Icuk Production Control System</h4>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {/* Notification Dropdown */}
                            <Dropdown
                                styles={{ root: { maxHeight: '60vh', overflowY: 'auto' } }}
                                menu={{
                                    items: (notifications?.messages?.length ?? 0) > 0
                                        ? [
                                              { type: 'divider' as const },
                                              ...(notifications?.messages ?? []).map((msg: any, index: number) => ({
                                                  key: index,
                                                  label: (
                                                      <div style={{ padding: '4px 0', maxWidth: 350 }}>
                                                          <div style={{ fontSize: 11, color: '#888' }}>
                                                              {msg.menu}
                                                          </div>
                                                          <div style={{ fontSize: 12 }}>
                                                              {msg.message}
                                                          </div>
                                                      </div>
                                                  ),
                                              })),
                                              { type: 'divider' as const },
                                          ]
                                        : [
                                              {
                                                  key: 'empty',
                                                  label: (
                                                      <div style={{ padding: '8px 0', textAlign: 'center', color: '#888' }}>
                                                          No notifications
                                                      </div>
                                                  ),
                                              },
                                          ],
                                }}
                                placement="bottomRight"
                                trigger={['click']}
                            >
                                <Badge count={(notifications?.messages?.length ?? 0)} size="small" offset={[-2, 2]} showZero={false}>
                                    <BellOutlined style={{ fontSize: 18, color: 'white', cursor: 'pointer' }} />
                                </Badge>
                            </Dropdown>

                            {/* User Info */}
                            <Space>
                                <span style={{ marginRight: 8, color: 'white' }}>
                                    Hello, {user?.Name || 'User'}
                                </span>
                                <Dropdown menu={{ items: userMenu }} placement="bottomRight">
                                    <Avatar icon={<UserOutlined />} style={{ cursor: 'pointer' }} />
                                </Dropdown>
                            </Space>
                        </div>
                    </Header>

                    {/* Content Area */}
                    <Content style={{ margin: '20px 10px 0', overflow: 'initial' }}>
                        <div
                            style={{
                                padding: 8,
                                minHeight: '100%',
                                background: '#ffffff',
                                borderRadius: 8,
                            }}
                        >
                            {children}
                        </div>
                    </Content>

                    {/* Footer */}
                    <Footer className="batik-bg" style={{ textAlign: 'center', color: 'white' }}>
                        IPCS - Inventory Production Control System © {new Date().getFullYear()} PT Vuteq Indonesia
                    </Footer>
                </Layout>
            </Layout>

            {/* Session Management Modal */}
            <Modal
                title="Session Management"
                open={sessionModalVisible}
                centered={true}
                onCancel={handleCloseSessionModal}
                footer={[
                    <button
                        key="close"
                        onClick={handleCloseSessionModal}
                        className="ant-btn ant-btn-default"
                    >
                        Close
                    </button>,
                    <button
                        key="refresh"
                        onClick={() => dispatch(fetchSessions())}
                        className="ant-btn ant-btn-primary"
                    >
                        Refresh
                    </button>,
                ]}
                width={1000}
            >
                <Table
                    columns={sessionColumns}
                    dataSource={sessions}
                    rowKey="SessionId"
                    loading={sessionLoading}
                    pagination={{ pageSize: 20 }}
                    scroll={{ x: 'max-content' }}
                />
            </Modal>
        </>
    );
};

export default AppLayout;
