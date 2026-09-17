/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 - Updated 2026-09-17 - Credits & Information with Update Log */

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
    BellOutlined,
    DatabaseOutlined,
    FileTextOutlined,
    HistoryOutlined,
    InboxOutlined,
    InfoCircleOutlined,
    LockOutlined,
    PieChartOutlined,
    SettingOutlined,
    ShopOutlined,
    UserOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import Image from 'next/image';
import {
    Layout,
    Menu,
    Avatar,
    Space,
    Dropdown,
    Badge,
    Spin,
    App,
    Button,
    Empty,
    Modal,
    Tag,
    Tooltip,
    Typography,
} from 'antd';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useVuteqSso } from '@vuteq/sso-client-react/react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '@/store';
import { setAuthData, clearAuth } from '@/store/features/auth/authSlice';
import { fetchNotifications, NotificationsEntity } from '@/store/features/notifications/notificationsSlice';
import CreditInformationModal from './_components/CreditInformationModal';
import '../batik.css';

const APP_VERSION = '1.19.0';
const APP_YEAR = '2026';

const LATEST_RELEASE_SUMMARY = [
    'Added approval workflow and transaction freeze on active inventory counting (stock opname).',
    'Added production report validation against forecast and pokayoke with operator modal.',
    'Revamped production display with skill matrix, finish good aliases, and real-time refresh.',
    'Migrated printer service to BullMQ with independent worker and dynamic LPR queue support.',
    'Integrated Credits & Information modal and chronological update log history.',
];

const { Header, Content, Footer, Sider } = Layout;
const { Paragraph, Text, Title } = Typography;

type ProjectCommit = {
    hash: string;
    shortHash: string;
    author: string;
    date: string;
    category: string;
    summary: string;
};

type ProjectCommitHistory = {
    repository: {
        commitCount: number;
        generatedAt: string;
    };
    commits: ProjectCommit[];
};

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

const getNotificationHref = (menu: string): string => {
    switch (menu) {
        case 'INCOMING':
            return '/apps/warehouse/incoming';
        case 'PRODUCTION_PLAN':
            return '/apps/production/production-release';
        case 'STOCK_OPNAME':
            return '/apps/warehouse/inventory-counting';
        case 'POKAYOKE':
            return '/apps/production/pokayoke';
        default:
            return '/apps';
    }
};

const AppLayout = ({ children }: { children: React.ReactNode }) => {
    const { modal } = App.useApp();
    const [collapsed, setCollapsed] = useState(false);
    const [creditModalVisible, setCreditModalVisible] = useState(false);
    const [privacyPolicyModalVisible, setPrivacyPolicyModalVisible] = useState(false);
    const [isPrivacyPolicyEnglish, setIsPrivacyPolicyEnglish] = useState(true);
    const [updateLogModalVisible, setUpdateLogModalVisible] = useState(false);
    const [commitHistory, setCommitHistory] = useState<ProjectCommitHistory | null>(null);
    const [commitHistoryLoading, setCommitHistoryLoading] = useState(false);
    const [commitHistoryError, setCommitHistoryError] = useState<string | null>(null);
    const router = useRouter();
    const pathname = usePathname();
    const dispatch = useDispatch<AppDispatch>();
    const { session, loading: sessionLoadingSso } = useVuteqSso();
    const ssoGlobalRoles = session?.globalRoles ?? [];
    const isSsoSuperAdmin =
        (session?.roles ?? []).includes('SUPER_ADMINISTRATOR') ||
        ssoGlobalRoles.includes('SUPER_ADMINISTRATOR');
    const { user } = useSelector((state: RootState) => state.auth);
    const { data: rawNotifications } = useSelector((state: RootState) => state.notifications);
    const notifications = useMemo(() => {
        if (!rawNotifications) return null;
        if (typeof rawNotifications === 'object' && 'data' in rawNotifications && (rawNotifications as any).data) {
            return (rawNotifications as any).data as NotificationsEntity;
        }
        return rawNotifications as NotificationsEntity;
    }, [rawNotifications]);
    const [isChecking, setIsChecking] = useState(true);

    const loadCommitHistory = async () => {
        setCommitHistoryLoading(true);
        setCommitHistoryError(null);
        try {
            const response = await fetch('/data/project-commit-history.json');
            if (!response.ok) {
                throw new Error('Unable to load update history.');
            }
            const data: ProjectCommitHistory = await response.json();
            setCommitHistory(data);
        } catch {
            setCommitHistoryError('Unable to load update history. Please try again.');
        } finally {
            setCommitHistoryLoading(false);
        }
    };

    const handleOpenUpdateLogModal = () => {
        setUpdateLogModalVisible(true);
        void loadCommitHistory();
    };

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
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <span>{m.label}</span>
                            <Badge count={notifications.totalIncomingNotClosed} size="small" />
                        </Space>
                    );
                }

                if (!m.disabled && m.key === 'prod-release' && notifications?.totalPOWithoutAttachment && notifications.totalPOWithoutAttachment > 0) {
                    label = (
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <span>{m.label}</span>
                            <Badge count={notifications.totalPOWithoutAttachment} size="small" />
                        </Space>
                    );
                }

                if (!m.disabled && m.key === 'wh-inventory-counting' && notifications?.totalStockOpnameInProgress && notifications.totalStockOpnameInProgress > 0) {
                    label = (
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <span>{m.label}</span>
                            <Badge count={notifications.totalStockOpnameInProgress} size="small" />
                        </Space>
                    );
                }

                if (!m.disabled && m.key === 'prod-pre-delivery' && notifications?.totalLabelDataNotScanned && notifications.totalLabelDataNotScanned > 0) {
                    label = (
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <span>{m.label}</span>
                            <Badge count={notifications.totalLabelDataNotScanned} size="small" />
                        </Space>
                    );
                }

                const warehouseCount = (notifications?.totalIncomingNotClosed || 0) + (notifications?.totalStockOpnameInProgress || 0);
                if (!m.disabled && m.key === 'warehouse' && warehouseCount > 0) {
                    label = (
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <span>{extractLabelText(m.label)}</span>
                            <Badge count={warehouseCount} size="small" />
                        </Space>
                    );
                }

                const prodCount = (notifications?.totalPOWithoutAttachment || 0) + (notifications?.totalLabelDataNotScanned || 0);
                if (!m.disabled && m.key === 'production' && prodCount > 0) {
                    label = (
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <span>{extractLabelText(m.label)}</span>
                            <Badge count={prodCount} size="small" />
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
        <>
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
                                                  { key: 'divider-top', type: 'divider' as const },
                                                  ...(notifications?.messages ?? []).map((msg: any, index: number) => ({
                                                      key: `notif-${index}`,
                                                      label: (
                                                          <Link
                                                              href={getNotificationHref(msg.menu)}
                                                              style={{ display: 'block', padding: '4px 0', maxWidth: 350, color: 'inherit' }}
                                                          >
                                                              <div style={{ fontSize: 11, color: '#1890ff', fontWeight: 600 }}>{msg.menu}</div>
                                                              <div style={{ fontSize: 12, color: '#334155', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                                                  {msg.message}
                                                              </div>
                                                          </Link>
                                                      ),
                                                  })),
                                                  { key: 'divider-bottom', type: 'divider' as const },
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

                            {/* Credits & Information Button */}
                            <Tooltip title="Credits & Information">
                                <Button
                                    type="text"
                                    aria-label="Open credits and information"
                                    onClick={() => setCreditModalVisible(true)}
                                    style={{
                                        width: 32,
                                        height: 32,
                                        padding: 0,
                                        lineHeight: 1,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                    icon={<InfoCircleOutlined style={{ fontSize: 20, color: 'white' }} />}
                                />
                            </Tooltip>

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

        {/* Privacy Policy Modal */}
        <Modal
            title={isPrivacyPolicyEnglish ? 'Privacy Policy' : 'Kebijakan Privasi'}
            open={privacyPolicyModalVisible}
            centered
            onCancel={() => setPrivacyPolicyModalVisible(false)}
            footer={[
                <Button key="language" onClick={() => setIsPrivacyPolicyEnglish((current) => !current)}>
                    {isPrivacyPolicyEnglish ? 'Bahasa Indonesia' : 'English'}
                </Button>,
                <Button key="close" type="primary" onClick={() => setPrivacyPolicyModalVisible(false)}>
                    {isPrivacyPolicyEnglish ? 'Close' : 'Tutup'}
                </Button>,
            ]}
            width={820}
            styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
        >
            {isPrivacyPolicyEnglish ? (
                <>
                    <Title level={4}>Employee and Operational Data Protection Policy</Title>
                    <Paragraph>
                        <Text strong>Effective date: </Text>{APP_YEAR}. This Privacy Policy explains how ANSEI
                        Inventory & Production System (&quot;ANSEI&quot;), operated for PT Vuteq Indonesia, processes
                        and protects user, operator, inventory, and manufacturing execution data. It supports compliance
                        with Indonesian personal data protection requirements, including Law No. 27 of 2022 on Personal
                        Data Protection (PDP Law), and internal manufacturing governance.
                    </Paragraph>
                    <Title level={5}>1. User Identity and Operator Data We Process</Title>
                    <Paragraph>
                        <Text strong>System Users: </Text>User ID, full name, corporate email, SSO identifier, assigned
                        roles and granular permissions (RBAC), active session tokens, login timestamps, and IP addresses.
                    </Paragraph>
                    <Paragraph>
                        <Text strong>Shop Floor Manpower & Operators: </Text>Employee Identification Number (NIK), full
                        name, department, assigned production line, work shift, Skill Matrix competency ratings, and
                        operator profile pictures used on shop-floor digital displays.
                    </Paragraph>
                    <Paragraph>
                        <Text strong>Signatures & Attributions: </Text>Digital signature images of delivery note
                        receivers, approver identities on Stock Opname reconciliation forms, and actor usernames attached
                        to every system transaction.
                    </Paragraph>
                    <Title level={5}>2. Manufacturing Execution and Warehouse Data</Title>
                    <Paragraph>
                        <Text strong>Warehouse & Inventory: </Text>Material and finish-good part numbers, supplier
                        delivery orders (DO), physical stock opname counting entries, material transfer notes, and
                        immutable ledger entries (<Text code>InventoryLedger</Text>) enforcing the invariant
                        balance formula: <Text italic>BalanceAfter = BalanceBefore + QtyIn - QtyOut</Text>.
                    </Paragraph>
                    <Paragraph>
                        <Text strong>Production & Quality (Poka-Yoke): </Text>Customer demand forecasts, work order
                        production releases, Bill of Materials (BOM) formulas, shopping picking sheets, barcode/QR scan
                        verification logs with comparison statuses (SUKSES/GAGAL), shift production outputs, and defect
                        (NG/scrap) tallies.
                    </Paragraph>
                    <Title level={5}>3. Purposes of Data Processing</Title>
                    <Paragraph>
                        Data is collected and processed strictly to maintain accurate real-time inventory balances,
                        generate Material Requirements Planning (MRP) calculations, prevent assembly line errors through
                        automated Poka-Yoke error-proofing, generate delivery documentation, and maintain tamper-proof
                        audit trails for internal and customer audits.
                    </Paragraph>
                    <Title level={5}>4. Security, Audit Logging, and Infrastructure</Title>
                    <Paragraph>
                        All records are stored on company-controlled infrastructure. The system maintains strict
                        auditability through automated logging (<Text code>LogProcess</Text> and <Text code>LogProcessDetail</Text>),
                        recording every state change with actor attribution, timestamp, and location. Access is enforced
                        through role-based access control, least-privilege principles, encrypted transmission, and
                        centralized Vuteq SSO.
                    </Paragraph>
                    <Title level={5}>5. Data Retention and Contact</Title>
                    <Paragraph>
                        Operational, inventory, and traceability logs are retained in accordance with automotive
                        manufacturing standards and statutory retention periods. For questions regarding your personal
                        data or operational records, please contact the IT Department or designated system administrators
                        at PT Vuteq Indonesia.
                    </Paragraph>
                </>
            ) : (
                <>
                    <Title level={4}>Kebijakan Perlindungan Data Pribadi dan Operasional</Title>
                    <Paragraph>
                        <Text strong>Tanggal berlaku: </Text>{APP_YEAR}. Kebijakan Privasi ini menjelaskan bagaimana
                        ANSEI Inventory & Production System (&quot;ANSEI&quot;), yang dioperasikan untuk PT Vuteq
                        Indonesia, memproses dan mengamankan data pengguna, tenaga kerja operator, mutasi inventaris,
                        dan eksekusi manufaktur. Kebijakan ini mendukung kepatuhan terhadap Undang-Undang Nomor 27 Tahun
                        2022 tentang Perlindungan Data Pribadi (UU PDP) serta standar tata kelola manufaktur internal.
                    </Paragraph>
                    <Title level={5}>1. Data Identitas Pengguna dan Operator yang Diproses</Title>
                    <Paragraph>
                        <Text strong>Pengguna Sistem: </Text>User ID, nama lengkap, email perusahaan, ID akun Vuteq SSO,
                        peran serta hak akses terperinci (RBAC), token sesi aktif, catatan waktu login, dan alamat IP.
                    </Paragraph>
                    <Paragraph>
                        <Text strong>Tenaga Kerja & Operator Produksi: </Text>Nomor Induk Karyawan (NIK), nama lengkap,
                        departemen, lini produksi yang ditugaskan, jadwal shift kerja, penilaian matriks keahlian (Skill
                        Matrix), dan foto profil operator untuk tampilan display digital lini produksi.
                    </Paragraph>
                    <Paragraph>
                        <Text strong>Tanda Tangan & Otorisasi: </Text>Gambar tanda tangan digital penerima pada Surat
                        Jalan (Material Delivery Note), identitas penyetujui berita acara Stock Opname, serta rekam jejak
                        nama pengguna pada setiap transaksi sistem.
                    </Paragraph>
                    <Title level={5}>2. Data Operasional Manufaktur dan Pergudangan</Title>
                    <Paragraph>
                        <Text strong>Pergudangan & Inventaris: </Text>Nomor part material dan finish good, surat jalan
                        supplier (DO), pencatatan fisik stock opname, transfer antar rak, serta buku besar inventaris
                        (<Text code>InventoryLedger</Text>) yang menjaga rumus saldo mutlak: <Text italic>BalanceAfter =
                        BalanceBefore + QtyIn - QtyOut</Text>.
                    </Paragraph>
                    <Paragraph>
                        <Text strong>Produksi & Kualitas (Poka-Yoke): </Text>Peramalan kebutuhan (Forecast), rilis surat
                        perintah kerja (Production Release), Bill of Materials (BOM), daftar shopping material, riwayat
                        pemindaian barcode/QR Poka-Yoke dengan status perbandingan (SUKSES/GAGAL), hasil produksi shift,
                        dan catatan produk cacat (NG/scrap).
                    </Paragraph>
                    <Title level={5}>3. Tujuan Pemrosesan Data</Title>
                    <Paragraph>
                        Data diproses semata-mata untuk mengelola akurasi stok material secara langsung (real-time),
                        perhitungan kebutuhan material (MRP), pencegahan kesalahan perakitan melalui validasi Poka-Yoke
                        otomatis, pembuatan dokumen surat jalan, serta penyediaan jejak audit yang tidak dapat dimanipulasi
                        untuk audit mutu internal maupun pelanggan.
                    </Paragraph>
                    <Title level={5}>4. Keamanan, Pencatatan Audit, dan Infrastruktur</Title>
                    <Paragraph>
                        Seluruh data disimpan di infrastruktur internal yang dikendalikan oleh perusahaan. ANSEI
                        menerapkan auditabilitas ketat melalui pencatatan log otomatis (<Text code>LogProcess</Text> dan{' '}
                        <Text code>LogProcessDetail</Text>) yang mencatat setiap mutasi data bersama identitas aktor, waktu,
                        dan modul terkait. Akses dilindungi dengan otorisasi berbasis peran, prinsip hak akses minimum,
                        enkripsi saluran komunikasi, dan integrasi terpusat Vuteq SSO.
                    </Paragraph>
                    <Title level={5}>5. Retensi Data dan Hak Pengguna</Title>
                    <Paragraph>
                        Data operasional, mutasi inventaris, dan rekam jejak mutu disimpan sesuai standar retensi industri
                        manufaktur otomotif. Untuk pertanyaan atau permintaan perbaikan data operasional Anda, silakan
                        menghubungi Departemen IT atau administrator sistem di PT Vuteq Indonesia.
                    </Paragraph>
                </>
            )}
        </Modal>

        {/* Update Log Modal */}
        <Modal
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                        display: 'inline-flex',
                        padding: 8,
                        borderRadius: 4,
                        color: 'white',
                        background: '#4C6A85',
                    }}>
                        <HistoryOutlined />
                    </span>
                    <div>
                        <div style={{ lineHeight: 1.2 }}>Update Log</div>
                        <div style={{ marginTop: 2, color: '#64748b', fontSize: 12, fontWeight: 400 }}>
                            A chronological record of ANSEI improvements
                        </div>
                    </div>
                </div>
            }
            open={updateLogModalVisible}
            centered
            onCancel={() => setUpdateLogModalVisible(false)}
            footer={<Button type="primary" onClick={() => setUpdateLogModalVisible(false)}>Close</Button>}
            width={860}
            styles={{ body: { maxHeight: '64vh', overflowY: 'auto', paddingTop: 8 } }}
        >
            {commitHistoryLoading ? (
                <div style={{ padding: 48, textAlign: 'center' }}>
                    <Spin size="large" description="Loading update history..." />
                </div>
            ) : commitHistoryError ? (
                <Empty description={commitHistoryError}>
                    <Button type="primary" onClick={() => void loadCommitHistory()}>Reload</Button>
                </Empty>
            ) : commitHistory ? (
                <div>
                    <div style={{
                        marginBottom: 16,
                        padding: '16px',
                        border: '1px solid #bfdbfe',
                        borderRadius: 8,
                        background: '#eff6ff',
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 12,
                            alignItems: 'center',
                        }}>
                            <div style={{
                                color: '#1e3a5f',
                                fontSize: 16,
                                fontWeight: 700,
                            }}>Version {APP_VERSION}</div>
                            <Tag color="blue">Latest release</Tag>
                        </div>
                        <div style={{ marginTop: 8, color: '#334155', fontSize: 13, lineHeight: 1.6 }}>
                            This release combines the latest committed platform improvements with the current
                            inventory & production system enhancements.
                        </div>
                        <ul style={{
                            margin: '10px 0 0',
                            paddingLeft: 20,
                            color: '#334155',
                            fontSize: 13,
                            lineHeight: 1.65,
                        }}>
                            {LATEST_RELEASE_SUMMARY.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                    </div>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16,
                        marginBottom: 20,
                        padding: '14px 16px',
                        borderRadius: 6,
                        color: '#4C6A85',
                        background: '#EDF2F6',
                    }}>
                        <div>
                            <strong>{commitHistory.repository.commitCount} recorded updates</strong>
                            <div style={{ marginTop: 3, color: '#475569', fontSize: 12 }}>
                                From the first project commit to the latest available update.
                            </div>
                        </div>
                        <Button onClick={() => void loadCommitHistory()}>Reload</Button>
                    </div>
                    <div style={{ display: 'grid', gap: 12 }}>
                        {commitHistory.commits.map((commit) => (
                            <div key={commit.hash} style={{
                                position: 'relative',
                                padding: '14px 16px 14px 22px',
                                borderRadius: 12,
                                background: '#fff',
                                boxShadow: '0 3px 10px rgba(0,0,0,0.03)',
                            }}>
                                <span style={{
                                    position: 'absolute',
                                    top: 20,
                                    left: 9,
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: commit.category === 'Fix' ? '#A34A4A' : '#4C6A85',
                                }} />
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    gap: 12,
                                }}>
                                    <div style={{
                                        color: '#1e293b',
                                        fontWeight: 600,
                                        lineHeight: 1.45,
                                    }}>{commit.summary}</div>
                                    <Tag
                                        color={commit.category === 'Feature' ? 'green' : commit.category === 'Fix' ? 'red' : 'blue'}>
                                        {commit.category}
                                    </Tag>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '6px 12px',
                                    marginTop: 9,
                                    color: '#64748b',
                                    fontSize: 12,
                                }}>
                                    <span>#{commit.shortHash}</span>
                                    <span>{commit.author}</span>
                                    <span>{new Date(commit.date).toLocaleString('en-US', {
                                        dateStyle: 'medium',
                                        timeStyle: 'short',
                                    })}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </Modal>

        {/* Credit Information Modal */}
        <CreditInformationModal
            open={creditModalVisible}
            onClose={() => setCreditModalVisible(false)}
            onOpenUpdateLog={handleOpenUpdateLogModal}
            onOpenPrivacyPolicy={() => setPrivacyPolicyModalVisible(true)}
        />
    </>
    );
};

export default AppLayout;
