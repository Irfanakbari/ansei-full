/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 - Updated 2026-06-18 - Original Theme with Font Improvements */

"use client";

import React, {useState} from 'react';
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
import type {MenuProps} from 'antd';
import Image from 'next/image';
import {Layout, Menu, Avatar, Space, Dropdown, Badge} from 'antd';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useVuteqSso} from '@vuteq/sso-client-react/react';
import {useDispatch, useSelector} from 'react-redux';
import {RootState, AppDispatch} from '@/store';
import {setAuthData, clearAuth} from '@/store/features/auth/authSlice';
import {fetchNotifications} from '@/store/features/notifications/notificationsSlice';
import '../batik.css';
import {LockOutlined} from '@ant-design/icons';

const APP_VERSION = '1.6.4';
const {Header, Content, Footer, Sider} = Layout;

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
    getItem(<Link href="/apps">Dashboard</Link>, 'dashboard', <PieChartOutlined/>),
    getItem('Master Data', 'master-data', <DatabaseOutlined/>, [
        getItem(<Link href="/apps/master-data/satuan">Unit</Link>, 'md-satuan'),
        getItem(<Link href="/apps/master-data/supplier">Supplier</Link>, 'md-supplier'),
        getItem(<Link href="/apps/master-data/material">Material</Link>, 'md-material'),
        getItem(<Link href="/apps/master-data/finish-good">Finish Good</Link>, 'md-finish-good'),
        getItem(<Link href="/apps/master-data/bill-of-materials">Bill of Materials</Link>, 'md-bom'),
        getItem(<Link href="/apps/master-data/box-qty">Box QTY</Link>, 'md-box-qty'),
        getItem(<Link href="/apps/master-data/man-power">Man Power</Link>, 'md-man-power'),
    ]),
    getItem('Warehouse', 'warehouse', <InboxOutlined/>, [
        getItem(<Link href="/apps/warehouse/incoming">Incoming Warehouse</Link>, 'wh-incoming'),
        getItem(<Link href="/apps/warehouse/transfer">Transfer to Rack</Link>, 'wh-transfer'),
        getItem(<Link href="/apps/warehouse/mrp">Material Run-out</Link>, 'wh-mrp'),
        getItem(<Link href="/apps/warehouse/inventory-counting">Inventory Counting</Link>, 'wh-inventory-counting'),
        getItem(<Link href="/apps/warehouse/transfer-material">Transfer Material</Link>, 'wh-transfer-material'),
    ]),
    getItem('Production', 'production', <ShopOutlined/>, [
        getItem(<Link href="/apps/production/forecast">Forecast</Link>, 'prod-forecast'),
        getItem(<Link href="/apps/production/production-release">Production Release</Link>, 'prod-release'),
        getItem('Process', 'production-process', <ShopOutlined/>, [
            getItem(<Link href="/apps/production/shopping">Shopping</Link>, 'prod-shopping'),
            getItem(<Link href="/apps/production/pre-delivery">Pre Delivery Goods</Link>, 'prod-pre-delivery'),
            getItem(<Link href="/apps/production/pokayoke">Pokayoke Validation</Link>, 'prod-pokayoke'),
            getItem(<Link href="/apps/production/delivery">Delivery</Link>, 'prod-delivery'),
        ]),
        getItem(<Link href="/apps/production/production-report">Production Report</Link>, 'prod-production-report'),
    ]),
    getItem('System Administration', 'system-administration', <SettingOutlined/>, [
        getItem(<Link href="/apps/system-administration/user-accounts">User
            Accounts</Link>, 'sa-user-accounts', undefined, undefined, ['USER_MANAGEMENT']),
        getItem(<Link href="/apps/system-administration/roles-configuration">Roles
            Configuration</Link>, 'sa-roles-configuration', undefined, undefined, ['USER_MANAGEMENT']),
        getItem(<Link href="/apps/system-administration/api-key-management">API Key
            Management</Link>, 'sa-api-key-management'),
        getItem(<Link href="/apps/system-administration/permissions-setup">Permissions
            Setup</Link>, 'sa-permissions-setup', undefined, undefined, ['USER_MANAGEMENT']),
        getItem(<Link href="/apps/system-administration/system-log">System Logs</Link>, 'sa-system-logs'),
        getItem(<Link href="/apps/system-administration/stock-transaction-log">Stock Transaction
            Log</Link>, 'sa-stock-transaction-log'),
        getItem(<Link href="/apps/system-administration/printer-config">Printer Config</Link>, 'sa-printer-config'),
        getItem(<Link href="/apps/system-administration/email-config">Email Config</Link>, 'sa-email-config'),
        getItem(<Link href="/apps/system-administration/display-config">Display Config</Link>, 'sa-display-config'),
    ]),
    getItem(<Link href="/apps/report">Reports</Link>, 'reports', <FileTextOutlined/>),
];

const applyPermission = (
    menus: MenuItem[],
    permissions: string[],
    roleName?: string,
    globalRoles: string[] = [],
): MenuItem[] => {
    const isSuper =
        roleName === 'SUPER' || globalRoles.includes('SUPER_ADMINISTRATOR');

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
                <span style={{opacity: 0.6}}>
                    {menuItem.label} <LockOutlined/>
                </span>
            );
        }

        if (menuItem.children) {
            return {
                ...menuItem,
                children: applyPermission(
                    menuItem.children as MenuItem[],
                    permissions,
                    roleName,
                    globalRoles,
                ),
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

const AppLayout = ({children}: { children: React.ReactNode }) => {
    const [collapsed, setCollapsed] = useState(false);
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const {session, loading: sessionLoadingSso} = useVuteqSso();
    const ssoGlobalRoles = session?.globalRoles ?? [];
    const isSsoSuperAdmin = (session?.roles ?? []).includes('SUPER_ADMINISTRATOR') || ssoGlobalRoles.includes('SUPER_ADMINISTRATOR');
    const {user} = useSelector((state: RootState) => state.auth);
    const {data: notifications} = useSelector((state: RootState) => state.notifications);
    const [isChecking, setIsChecking] = useState(true);

    React.useEffect(() => {
        const checkAuth = async () => {
            if (sessionLoadingSso) return;

            const isProcessing401 = typeof window !== 'undefined' && sessionStorage.getItem('processing401') === 'true';
            if (isProcessing401) {
                return;
            }

            if (session) {
                dispatch(setAuthData({
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
                    token: ''
                }));
                setIsChecking(false);
                return;
            }
            router.push('/');
        };

        checkAuth();
    }, [sessionLoadingSso, session, dispatch, router]);

    React.useEffect(() => {
        if (!isChecking) {
            dispatch(fetchNotifications());
            const intervalId = setInterval(() => {
                dispatch(fetchNotifications());
            }, 20000);
            return () => clearInterval(intervalId);
        }
    }, [isChecking, dispatch]);

    const handleLogout = () => {
        if (window.confirm('Apakah Anda yakin ingin keluar dari aplikasi dan SSO?')) {
            dispatch(clearAuth());
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/auth/logout';
            document.body.appendChild(form);
            form.submit();
        }
    };

    const userMenu: MenuProps['items'] = [
        {
            key: '1',
            label: (
                <span onClick={handleLogout}>
                    Logout
                </span>
            ),
        },
    ];

    const menuWithPermission = React.useMemo(() => {
        const menus = applyPermission(
            items,
            user?.Permission || [],
            isSsoSuperAdmin ? 'SUPER' : user?.RoleName,
            isSsoSuperAdmin ? ['SUPER_ADMINISTRATOR'] : (user?.GlobalRoles || []),
        );

        const addBadges = (menuList: MenuItem[]): MenuItem[] => {
            return menuList.map((menu) => {
                if (!menu || (menu as any).type === 'divider') return menu;

                const m = menu as any;
                let label = m.label;

                if (m.key === 'wh-incoming' && notifications?.totalIncomingNotClosed && notifications.totalIncomingNotClosed > 0) {
                    label = (
                        <Space>
                            {m.label}
                            <Badge count={notifications.totalIncomingNotClosed} size="small"/>
                        </Space>
                    );
                }

                if (m.key === 'prod-release' && notifications?.totalPOWithoutAttachment && notifications.totalPOWithoutAttachment > 0) {
                    label = (
                        <Space>
                            {m.label}
                            <Badge count={notifications.totalPOWithoutAttachment} size="small"/>
                        </Space>
                    );
                }

                if (m.key === 'wh-inventory-counting' && notifications?.totalStockOpnameInProgress && notifications.totalStockOpnameInProgress > 0) {
                    label = (
                        <Space>
                            {m.label}
                            <Badge count={notifications.totalStockOpnameInProgress} size="small"/>
                        </Space>
                    );
                }

                if (m.key === 'prod-pre-delivery' && notifications?.totalLabelDataNotScanned && notifications.totalLabelDataNotScanned > 0) {
                    label = (
                        <Space>
                            {m.label}
                            <Badge count={notifications.totalLabelDataNotScanned} size="small"/>
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

                return {...m, label};
            });
        };

        return addBadges(menus);
    }, [user, notifications, isSsoSuperAdmin]);

    return (
        <>
            {sessionLoadingSso && <LoadingOverlay/>}
            <Layout style={{minHeight: '100vh', display: 'flex'}}>
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
                        <Image src="/images/ansei-white.png" alt="ANSEI logo" width={200} height={100}
                               priority/>
                    </div>
                    <Menu
                        theme="dark"
                        style={{background: 'transparent', padding: '4px 8px'}}
                        defaultSelectedKeys={['dashboard']}
                        mode="inline"
                        items={menuWithPermission}
                    />
                </Sider>

                {/* Main Content Area */}
                <Layout style={{
                    marginLeft: collapsed ? 80 : 300,
                    transition: 'margin-left 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100vh'
                }}>
                    {/* Header - Original Theme */}
                    <Header className="batik-bg ansei-header-footer" style={{
                        padding: '0 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        position: 'sticky',
                        top: 0,
                        zIndex: 1000,
                        width: '100%',
                        flexShrink: 0
                    }}>
                        <div style={{display: 'flex', alignItems: 'left'}}>
<h2 className="text-xl ml-1 text-white" style={{fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 20, fontWeight: 400, margin: 0, lineHeight: 'normal'}}>
Ansei Inventory & Production System
                                </h2>
                        </div>

                        <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                            <div style={{display: 'flex', alignItems: 'center', gap: 8, height: 32}}>
                                {/* Greeting */}
                                <span style={{marginRight: 8, color: 'white', lineHeight: '32px'}}>
                                    Hello, {user?.Name || 'User'}
                                </span>

                                {/* Notification Dropdown */}
                                <Dropdown
                                    styles={{root: {maxHeight: '60vh', overflowY: 'auto'}}}
                                    menu={{
                                        items: (notifications?.messages?.length ?? 0) > 0
                                            ? [
                                                {type: 'divider' as const},
                                                ...(notifications?.messages ?? []).map((msg: any, index: number) => ({
                                                    key: index,
                                                    label: (
                                                        <div style={{padding: '4px 0', maxWidth: 350}}>
                                                            <div style={{fontSize: 11, color: '#888'}}>
                                                                {msg.menu}
                                                            </div>
                                                            <div style={{fontSize: 12}}>
                                                                {msg.message}
                                                            </div>
                                                        </div>
                                                    ),
                                                })),
                                                {type: 'divider' as const},
                                            ]
                                            : [
                                                {
                                                    key: 'empty',
                                                    label: (
                                                        <div style={{padding: '8px 0', textAlign: 'center', color: '#888'}}>
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
                                        <Badge count={(notifications?.messages?.length ?? 0)} size="small"
                                               offset={[-2, 2]} showZero={false}>
                                            <BellOutlined style={{fontSize: 20, color: 'white'}}/>
                                        </Badge>
                                    </span>
                                </Dropdown>

                                {/* User Info */}
                                <Dropdown menu={{items: userMenu}} placement="bottomRight">
                                    <span
                                        style={{
                                            width: 32,
                                            height: 32,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Avatar icon={<UserOutlined/>} size={32} style={{cursor: 'pointer'}}/>
                                    </span>
                                </Dropdown>
                            </div>
                        </div>
                    </Header>

                    {/* Content Area */}
                    <Content style={{margin: '20px 10px', overflow: 'auto', flex: 1, minHeight: 0}}>
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
<Footer className="batik-bg ansei-header-footer" style={{
                         textAlign: 'center',
                         color: 'white',
                         fontSize: 14,
                         fontWeight: 400,
                        position: 'sticky',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: 999,
                        flexShrink: 0
                    }}>
                        <span>Ansei Inventory & Production System © {new Date().getFullYear()} PT Vuteq Indonesia</span>
                        <span style={{margin: '0 8px'}}>|</span>
                        <span>v{APP_VERSION}</span>
                    </Footer>
                </Layout>
            </Layout>
        </>
    );
};

export default AppLayout;
