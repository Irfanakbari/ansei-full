/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 - Updated 2026-06-18 - Original Theme with Font Improvements */

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
    BellOutlined,
    DatabaseOutlined,
    FileTextOutlined,
    InboxOutlined,
    LockOutlined,
    PieChartOutlined,
    SettingOutlined,
    ShopOutlined,
    UserOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import Image from 'next/image';
import { Layout, Menu, Avatar, Space, Dropdown, Badge, Spin, App } from 'antd';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useVuteqSso } from '@vuteq/sso-client-react/react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '@/store';
import { setAuthData, clearAuth } from '@/store/features/auth/authSlice';
import { fetchNotifications } from '@/store/features/notifications/notificationsSlice';
import '../batik.css';

const APP_VERSION = '1.7.0';
const { Header, Content, Footer, Sider } = Layout;

type MenuItem = Required<MenuProps>['items'][number] & {
    permission?: string[];
};

const PERMISSIONS = {
    // Master Data
    master: ['IPCS.MASTER_READ'],

    // Warehouse
    incoming: ['IPCS.INCOMING_READ'],
    transfer: ['IPCS.TRANSFER_READ', 'IPCS.TRANSFER_CREATE'],
    mrp: ['IPCS.MRP_READ'],
    inventoryCounting: ['IPCS.INVENTORY_COUNTING_READ'],
    transferMaterial: ['IPCS.TRANSFER_MATERIAL_READ'],

    // Production
    forecast: ['IPCS.FORECAST_READ'],
    productionRelease: ['IPCS.PRODUCTION_RELEASE_READ'],
    shopping: ['IPCS.SHOPPING_READ'],
    preDelivery: ['IPCS.PRE_DELIVERY_READ'],
    pokayoke: ['IPCS.POKAYOKE_READ', 'IPCS.POKAYOKE_CREATE'],
    delivery: ['IPCS.DELIVERY_READ', 'IPCS.DELIVERY_CREATE'],
    productionReport: ['IPCS.PRODUCTION_REPORT_READ'],

    // System Administration
    userManagement: ['IPCS.USER_MANAGEMENT', 'USER_MANAGEMENT'],
    apiKeys: ['IPCS.API_KEY_READ'],
    systemLogs: ['IPCS.SYSTEM_LOG_READ'],
    stockTransactionLogs: ['IPCS.REPORT_READ'],
    printer: ['IPCS.MASTER_READ'],
    email: ['IPCS.MASTER_READ'],
    display: ['DISPLAY_CONFIG_READ'],

    // Report
    reports: ['IPCS.REPORT_READ'],
} as const;

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
        permission,
    } as MenuItem;
}

const baseMenuItems: MenuItem[] = [
    getItem(<Link href="/apps">Dashboard</Link>, 'dashboard', <PieChartOutlined />),
    getItem('Master Data', 'master-data', <DatabaseOutlined />, [
        getItem(<Link href="/apps/master-data/satuan">Unit</Link>, 'md-satuan', undefined, undefined, [...PERMISSIONS.master]),
        getItem(<Link href="/apps/master-data/supplier">Supplier</Link>, 'md-supplier', undefined, undefined, [...PERMISSIONS.master]),
        getItem(<Link href="/apps/master-data/material">Material</Link>, 'md-material', undefined, undefined, [...PERMISSIONS.master]),
        getItem(<Link href="/apps/master-data/finish-good">Finish Good</Link>, 'md-finish-good', undefined, undefined, [...PERMISSIONS.master]),
        getItem(<Link href="/apps/master-data/bill-of-materials">Bill of Materials</Link>, 'md-bom', undefined, undefined, [...PERMISSIONS.master]),
        getItem(<Link href="/apps/master-data/box-qty">Box QTY</Link>, 'md-box-qty', undefined, undefined, [...PERMISSIONS.master]),
        getItem(<Link href="/apps/master-data/man-power">Man Power</Link>, 'md-man-power', undefined, undefined, [...PERMISSIONS.master]),
    ]),
    getItem('Warehouse', 'warehouse', <InboxOutlined />, [
        getItem(<Link href="/apps/warehouse/incoming">Incoming Warehouse</Link>, 'wh-incoming', undefined, undefined, [...PERMISSIONS.incoming]),
        getItem(<Link href="/apps/warehouse/transfer">Transfer to Rack</Link>, 'wh-transfer', undefined, undefined, [...PERMISSIONS.transfer]),
        getItem(<Link href="/apps/warehouse/mrp">Material Run-out</Link>, 'wh-mrp', undefined, undefined, [...PERMISSIONS.mrp]),
        getItem(<Link href="/apps/warehouse/inventory-counting">Inventory Counting</Link>, 'wh-inventory-counting', undefined, undefined, [...PERMISSIONS.inventoryCounting]),
        getItem(<Link href="/apps/warehouse/transfer-material">Transfer Material</Link>, 'wh-transfer-material', undefined, undefined, [...PERMISSIONS.transferMaterial]),
    ]),
    getItem('Production', 'production', <ShopOutlined />, [
        getItem(<Link href="/apps/production/forecast">Forecast</Link>, 'prod-forecast', undefined, undefined, [...PERMISSIONS.forecast]),
        getItem(<Link href="/apps/production/production-release">Production Release</Link>, 'prod-release', undefined, undefined, [...PERMISSIONS.productionRelease]),
        getItem('Process', 'production-process', <ShopOutlined />, [
            getItem(<Link href="/apps/production/shopping">Shopping</Link>, 'prod-shopping', undefined, undefined, [...PERMISSIONS.shopping]),
            getItem(<Link href="/apps/production/pre-delivery">Pre Delivery Goods</Link>, 'prod-pre-delivery', undefined, undefined, [...PERMISSIONS.preDelivery]),
            getItem(<Link href="/apps/production/pokayoke">Pokayoke Validation</Link>, 'prod-pokayoke', undefined, undefined, [...PERMISSIONS.pokayoke]),
            getItem(<Link href="/apps/production/delivery">Delivery</Link>, 'prod-delivery', undefined, undefined, [...PERMISSIONS.delivery]),
        ]),
        getItem(<Link href="/apps/production/production-report">Production Report</Link>, 'prod-production-report', undefined, undefined, [...PERMISSIONS.productionReport]),
    ]),
    getItem('System Administration', 'system-administration', <SettingOutlined />, [
        getItem(<Link href="/apps/system-administration/user-accounts">User Accounts</Link>, 'sa-user-accounts', undefined, undefined, [...PERMISSIONS.userManagement]),
        getItem(<Link href="/apps/system-administration/roles-configuration">Roles Configuration</Link>, 'sa-roles-configuration', undefined, undefined, [...PERMISSIONS.userManagement]),
        getItem(<Link href="/apps/system-administration/api-key-management">API Key Management</Link>, 'sa-api-key-management', undefined, undefined, [...PERMISSIONS.apiKeys]),
        getItem(<Link href="/apps/system-administration/permissions-setup">Permissions Setup</Link>, 'sa-permissions-setup', undefined, undefined, [...PERMISSIONS.userManagement]),
        getItem(<Link href="/apps/system-administration/system-log">System Logs</Link>, 'sa-system-logs', undefined, undefined, [...PERMISSIONS.systemLogs]),
        getItem(<Link href="/apps/system-administration/stock-transaction-log">Stock Transaction Log</Link>, 'sa-stock-transaction-log', undefined, undefined, [...PERMISSIONS.stockTransactionLogs]),
        getItem(<Link href="/apps/system-administration/printer-config">Printer Config</Link>, 'sa-printer-config', undefined, undefined, [...PERMISSIONS.printer]),
        getItem(<Link href="/apps/system-administration/email-config">Email Config</Link>, 'sa-email-config', undefined, undefined, [...PERMISSIONS.email]),
        getItem(<Link href="/apps/system-administration/display-config">Display Config</Link>, 'sa-display-config', undefined, undefined, [...PERMISSIONS.display]),
    ]),
    getItem(<Link href="/apps/report">Reports</Link>, 'reports', <FileTextOutlined />, undefined, [...PERMISSIONS.reports]),
];

const extractLabelText = (label: React.ReactNode): React.ReactNode => {
    if (React.isValidElement(label) && (label.props as any)?.children) {
        return (label.props as any).children;
    }
    return label;
};

const applyPermission = (
    menus: MenuItem[],
    permissions: string[],
    roleName?: string,
    globalRoles: string[] = [],
): MenuItem[] => {
    const isSuper =
        roleName === 'SUPER' ||
        globalRoles.includes('SUPER_ADMINISTRATOR') ||
        permissions.includes('SUPER') ||
        permissions.includes('*');

    return menus.map((menu) => {
        if (!menu || (menu as any).type === 'divider') {
            return menu;
        }

        const menuItem = menu as any;

        // Process children recursively if any
        let processedChildren: MenuItem[] | undefined;
        let hasActiveChild = false;

        if (menuItem.children && menuItem.children.length > 0) {
            processedChildren = applyPermission(
                menuItem.children as MenuItem[],
                permissions,
                roleName,
                globalRoles,
            );
            hasActiveChild = processedChildren.some((child) => child && !(child as any).disabled);
        }

        // Determine permission for this menu item
        const matchesSelfPermission =
            !menuItem.permission ||
            menuItem.permission.length === 0 ||
            menuItem.permission.some((p: string) => permissions.includes(p));

        const hasPermission =
            isSuper ||
            (processedChildren
                ? (matchesSelfPermission || !menuItem.permission) && hasActiveChild
                : matchesSelfPermission);

        let finalLabel = menuItem.label;

        if (!hasPermission) {
            finalLabel = (
                <span
                    style={{
                        opacity: 0.6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        cursor: 'not-allowed',
                    }}
                >
                    <span>{extractLabelText(menuItem.label)}</span>
                    <LockOutlined style={{ fontSize: 12, marginLeft: 6, color: '#94a3b8' }} />
                </span>
            );
        }

        if (processedChildren) {
            return {
                ...menuItem,
                children: processedChildren,
                label: finalLabel,
                disabled: !hasPermission,
            };
        }

        return {
            ...menuItem,
            label: finalLabel,
            disabled: !hasPermission,
        };
    });
};

const getMenuKeyFromPath = (path: string): string => {
    if (!path || path === '/apps') return 'dashboard';
    if (path.startsWith('/apps/master-data/satuan')) return 'md-satuan';
    if (path.startsWith('/apps/master-data/supplier')) return 'md-supplier';
    if (path.startsWith('/apps/master-data/material')) return 'md-material';
    if (path.startsWith('/apps/master-data/finish-good')) return 'md-finish-good';
    if (path.startsWith('/apps/master-data/bill-of-materials')) return 'md-bom';
    if (path.startsWith('/apps/master-data/box-qty')) return 'md-box-qty';
    if (path.startsWith('/apps/master-data/man-power')) return 'md-man-power';
    if (path.startsWith('/apps/warehouse/incoming')) return 'wh-incoming';
    if (path.startsWith('/apps/warehouse/transfer-material')) return 'wh-transfer-material';
    if (path.startsWith('/apps/warehouse/transfer')) return 'wh-transfer';
    if (path.startsWith('/apps/warehouse/mrp')) return 'wh-mrp';
    if (path.startsWith('/apps/warehouse/inventory-counting')) return 'wh-inventory-counting';
    if (path.startsWith('/apps/production/forecast')) return 'prod-forecast';
    if (path.startsWith('/apps/production/production-release')) return 'prod-release';
    if (path.startsWith('/apps/production/shopping')) return 'prod-shopping';
    if (path.startsWith('/apps/production/pre-delivery')) return 'prod-pre-delivery';
    if (path.startsWith('/apps/production/pokayoke')) return 'prod-pokayoke';
    if (path.startsWith('/apps/production/delivery')) return 'prod-delivery';
    if (path.startsWith('/apps/production/production-report')) return 'prod-production-report';
    if (path.startsWith('/apps/system-administration/user-accounts')) return 'sa-user-accounts';
    if (path.startsWith('/apps/system-administration/roles-configuration')) return 'sa-roles-configuration';
    if (path.startsWith('/apps/system-administration/api-key-management')) return 'sa-api-key-management';
    if (path.startsWith('/apps/system-administration/permissions-setup')) return 'sa-permissions-setup';
    if (path.startsWith('/apps/system-administration/system-log')) return 'sa-system-logs';
    if (path.startsWith('/apps/system-administration/stock-transaction-log')) return 'sa-stock-transaction-log';
    if (path.startsWith('/apps/system-administration/printer-config')) return 'sa-printer-config';
    if (path.startsWith('/apps/system-administration/email-config')) return 'sa-email-config';
    if (path.startsWith('/apps/system-administration/display-config')) return 'sa-display-config';
    if (path.startsWith('/apps/report')) return 'reports';
    return 'dashboard';
};

const AppLayout = ({ children }: { children: React.ReactNode }) => {
    const { modal } = App.useApp();
    const [collapsed, setCollapsed] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const dispatch = useDispatch<AppDispatch>();
    const { session, loading: sessionLoadingSso } = useVuteqSso();
    const ssoGlobalRoles = session?.globalRoles ?? [];
    const isSsoSuperAdmin =
        (session?.roles ?? []).includes('SUPER_ADMINISTRATOR') ||
        ssoGlobalRoles.includes('SUPER_ADMINISTRATOR');
    const { user } = useSelector((state: RootState) => state.auth);
    const { data: notifications } = useSelector((state: RootState) => state.notifications);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            if (sessionLoadingSso) return;

            if (session) {
                if (typeof window !== 'undefined') {
                    sessionStorage.removeItem('processing401');
                }
                dispatch(
                    setAuthData({
                        user: {
                            UserId: session.user.sub,
                            Name: session.user.name ?? session.user.preferred_username ?? session.user.sub,
                            Email: session.user.email ?? '',
                            LastLogin: '',
                            DeptPermission: [],
                            RoleName: session.globalRoles.includes('SUPER_ADMINISTRATOR')
                                ? 'SUPER'
                                : (session.roles[0] ?? ''),
                            Permission: session.permissions,
                            GlobalRoles: session.globalRoles,
                        },
                        token: '',
                    }),
                );
                setIsChecking(false);
                return;
            }

            const isProcessing401 = typeof window !== 'undefined' && sessionStorage.getItem('processing401') === 'true';
            if (isProcessing401) {
                return;
            }

            window.location.replace('/auth/login');
        };

        checkAuth();
    }, [sessionLoadingSso, session, dispatch, router]);

    useEffect(() => {
        if (!isChecking) {
            dispatch(fetchNotifications());
            const intervalId = setInterval(() => {
                dispatch(fetchNotifications());
            }, 20000);
            return () => clearInterval(intervalId);
        }
    }, [isChecking, dispatch]);

    const handleLogout = () => {
        modal.confirm({
            centered: true,
            title: 'Konfirmasi Logout',
            content: 'Apakah Anda yakin ingin keluar dari aplikasi dan akun SSO?',
            okText: 'Logout',
            okButtonProps: { danger: true },
            cancelText: 'Batal',
            onOk: () => {
                dispatch(clearAuth());
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = '/auth/logout';
                document.body.appendChild(form);
                form.submit();
            },
        });
    };

    const userMenu: MenuProps['items'] = [
        {
            key: '1',
            label: <span onClick={handleLogout}>Logout</span>,
        },
    ];

    const menuWithPermission = useMemo(() => {
        const menus = applyPermission(
            baseMenuItems,
            user?.Permission || [],
            isSsoSuperAdmin ? 'SUPER' : user?.RoleName,
            isSsoSuperAdmin ? ['SUPER_ADMINISTRATOR'] : (user?.GlobalRoles || []),
        );

        const addBadges = (menuList: MenuItem[]): MenuItem[] => {
            return menuList.map((menu) => {
                if (!menu || (menu as any).type === 'divider') return menu;

                const m = menu as any;
                let label = m.label;

                if (!m.disabled && m.key === 'wh-incoming' && notifications?.totalIncomingNotClosed && notifications.totalIncomingNotClosed > 0) {
                    label = (
                        <Space>
                            {m.label}
                            <Badge count={notifications.totalIncomingNotClosed} size="small" />
                        </Space>
                    );
                }

                if (!m.disabled && m.key === 'prod-release' && notifications?.totalPOWithoutAttachment && notifications.totalPOWithoutAttachment > 0) {
                    label = (
                        <Space>
                            {m.label}
                            <Badge count={notifications.totalPOWithoutAttachment} size="small" />
                        </Space>
                    );
                }

                if (!m.disabled && m.key === 'wh-inventory-counting' && notifications?.totalStockOpnameInProgress && notifications.totalStockOpnameInProgress > 0) {
                    label = (
                        <Space>
                            {m.label}
                            <Badge count={notifications.totalStockOpnameInProgress} size="small" />
                        </Space>
                    );
                }

                if (!m.disabled && m.key === 'prod-pre-delivery' && notifications?.totalLabelDataNotScanned && notifications.totalLabelDataNotScanned > 0) {
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
    }, [user, notifications, isSsoSuperAdmin]);

    const activeMenuKey = useMemo(() => getMenuKeyFromPath(pathname || ''), [pathname]);

    if (sessionLoadingSso || isChecking) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617' }}>
                <Image src="/images/ansei-white.png" alt="ANSEI logo" width={180} height={90} priority style={{ marginBottom: '24px' }} />
                <Spin size="large" />
                <div style={{ marginTop: '16px', fontSize: '16px', color: '#cbd5e1' }}>Memeriksa sesi akun Vuteq Anda...</div>
            </div>
        );
    }

    return (
        <Layout style={{ minHeight: '100vh', display: 'flex' }}>
            {/* Sidebar - Original Theme */}
            <Sider
                className="ansei-sider"
                collapsible
                collapsed={collapsed}
                onCollapse={(value) => setCollapsed(value)}
                width={300}
                theme="dark"
                style={{
                    overflow: 'auto',
                    height: '100vh',
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    zIndex: 100,
                    background: '#263545',
                }}
            >
                <div className="text-center justify-center flex p-1">
                    <Image src="/images/ansei-white.png" alt="ANSEI logo" width={200} height={100} priority />
                </div>
                <Menu
                    theme="dark"
                    style={{ background: 'transparent', padding: '4px 8px' }}
                    selectedKeys={[activeMenuKey]}
                    mode="inline"
                    items={menuWithPermission}
                />
            </Sider>

            {/* Main Content Area */}
            <Layout
                style={{
                    marginLeft: collapsed ? 80 : 300,
                    transition: 'margin-left 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100vh',
                }}
            >
                {/* Header - Original Theme */}
                <Header
                    className="batik-bg ansei-header-footer"
                    style={{
                        padding: '0 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        position: 'sticky',
                        top: 0,
                        zIndex: 1000,
                        width: '100%',
                        flexShrink: 0,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <h2
                            className="text-xl ml-1 text-white"
                            style={{
                                fontFamily: 'Arial, Helvetica, sans-serif',
                                fontSize: 20,
                                fontWeight: 400,
                                margin: 0,
                                lineHeight: 'normal',
                            }}
                        >
                            Ansei Inventory & Production System
                        </h2>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32 }}>
                            {/* Greeting */}
                            <span style={{ marginRight: 8, color: 'white', lineHeight: '32px' }}>
                                Hello, {user?.Name || 'User'}
                            </span>

                            {/* Notification Dropdown */}
                            <Dropdown
                                styles={{ root: { maxHeight: '60vh', overflowY: 'auto' } }}
                                menu={{
                                    items:
                                        (notifications?.messages?.length ?? 0) > 0
                                            ? [
                                                  { type: 'divider' as const },
                                                  ...(notifications?.messages ?? []).map((msg: any, index: number) => ({
                                                      key: index,
                                                      label: (
                                                          <div style={{ padding: '4px 0', maxWidth: 350 }}>
                                                              <div style={{ fontSize: 11, color: '#888' }}>{msg.menu}</div>
                                                              <div style={{ fontSize: 12 }}>{msg.message}</div>
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
                                <span
                                    style={{
                                        width: 32,
                                        height: 32,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Badge
                                        count={notifications?.messages?.length ?? 0}
                                        size="small"
                                        offset={[-2, 2]}
                                        showZero={false}
                                    >
                                        <BellOutlined style={{ fontSize: 20, color: 'white' }} />
                                    </Badge>
                                </span>
                            </Dropdown>

                            {/* User Info */}
                            <Dropdown menu={{ items: userMenu }} placement="bottomRight">
                                <span
                                    style={{
                                        width: 32,
                                        height: 32,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Avatar icon={<UserOutlined />} size={32} style={{ cursor: 'pointer' }} />
                                </span>
                            </Dropdown>
                        </div>
                    </div>
                </Header>

                {/* Content Area */}
                <Content style={{ margin: '20px 10px', overflow: 'auto', flex: 1, minHeight: 0 }}>
                    <div
                        className="ansei-content-surface"
                        style={{
                            padding: 20,
                            minHeight: '100%',
                            background: '#FCFCFA',
                            borderRadius: 6,
                        }}
                    >
                        {children}
                    </div>
                </Content>

                {/* Footer */}
                <Footer
                    className="batik-bg ansei-header-footer"
                    style={{
                        textAlign: 'center',
                        color: 'white',
                        fontSize: 14,
                        fontWeight: 400,
                        position: 'sticky',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: 999,
                        flexShrink: 0,
                    }}
                >
                    <span>Ansei Inventory & Production System © {new Date().getFullYear()} PT Vuteq Indonesia</span>
                    <span style={{ margin: '0 8px' }}>|</span>
                    <span>v{APP_VERSION}</span>
                </Footer>
            </Layout>
        </Layout>
    );
};

export default AppLayout;
