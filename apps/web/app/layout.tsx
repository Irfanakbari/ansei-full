// By Irfan Akbari Vuteq Indonesia - 2026-06-18
import type {Metadata} from "next";
import {Inter} from "next/font/google";
import "./globals.css";
import {AntdRegistry} from "@ant-design/nextjs-registry";
import {ReduxProvider} from "@/store/provider";
import {ConfigProvider, App} from "antd";
import {VuteqSsoProvider} from "@vuteq/sso-client-react/react";
import React from "react";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
});

export const metadata: Metadata = {
    title: "IPS - ANSEI LINE",
    description: "IPS - ANSEI LINE",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
        <body className={`${inter.variable} antialiased`}>
        <VuteqSsoProvider
            sessionEndpoint="/api/auth/session"
            loginPath="/auth/login"
            logoutPath="/auth/logout"
        >
            <ReduxProvider>
                <ConfigProvider
                    theme={{
                        token: {
                            colorPrimary: '#4F46E5',
                            colorSuccess: '#16a34a',
                            colorWarning: '#d97706',
                            colorError: '#dc2626',
                            colorInfo: '#4F46E5',
                            colorText: '#293241',
                            colorTextSecondary: '#66727D',
                            colorBorder: '#D9DDDF',
                            colorBorderSecondary: '#E6E8E8',
                            colorBgLayout: '#F7F7F5',
                            colorBgContainer: '#FCFCFA',
                            colorBgElevated: '#FCFCFA',
                            colorLink: '#4C6A85',
                            colorLinkHover: '#3F596F',
                            fontFamily: 'Arial, Helvetica, sans-serif',
                            borderRadius: 4,
                            borderRadiusLG: 6,
                            boxShadowSecondary: '0 8px 20px rgba(38, 53, 69, 0.1)',
                        },
                        components: {
                            Layout: {
                                footerPadding: 10,
                                bodyBg: '#F7F7F5',
                                headerBg: '#263545',
                                footerBg: '#263545',
                            },
                            Menu: {
                                darkItemBg: '#263545',
                                darkSubMenuItemBg: '#304254',
                                darkPopupBg: '#304254',
                                darkItemColor: '#EDF2F6',
                                darkItemHoverBg: '#3A4E61',
                                darkItemSelectedBg: '#4C6A85',
                                darkItemSelectedColor: '#FFFFFF',
                            },
                            Table: {
                                cellPaddingBlock: 2,
                                cellPaddingBlockSM: 6,
                                rowSelectedBg: '#E4EBF0',
                                rowHoverBg: '#EDF2F6',
                                rowSelectedHoverBg: '#DCE6ED',
                                colorText: '#293241',
                            },
                            Tag: {
                                fontSize: 16,
                                fontSizeIcon: 16,
                            },
                        },
                    }}
                >
                    <AntdRegistry>
                        <App>{children}</App>
                    </AntdRegistry>
                </ConfigProvider>
            </ReduxProvider>
        </VuteqSsoProvider>
        </body>
        </html>
    );
}
