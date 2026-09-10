// By Irfan Akbari Vuteq Indonesia - 2026-06-18
import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ReduxProvider } from "@/store/provider";
import { ConfigProvider, App } from "antd";
import { NextAuthProvider } from "./providers/NextAuthProvider";
import React from "react";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

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
      <body className={`${plusJakartaSans.variable} ${inter.variable} antialiased`}>
        <NextAuthProvider>
          <ReduxProvider>
            <ConfigProvider
              theme={{
                token: {
                  // Primary color - Original Indigo
                  colorPrimary: '#4F46E5',
                  colorPrimaryHover: '#6366F1',
                  colorPrimaryActive: '#3730A3',
                  colorPrimaryBg: '#EEF2FF',
                  colorPrimaryBgHover: '#E0E7FF',

                  // Success
                  colorSuccess: '#10B981',
                  colorSuccessBg: '#D1FAE5',

                  // Warning
                  colorWarning: '#F59E0B',
                  colorWarningBg: '#FEF3C7',

                  // Error
                  colorError: '#EF4444',
                  colorErrorBg: '#FEE2E2',

                  // Info
                  colorInfo: '#3B82F6',
                  colorInfoBg: '#DBEAFE',

                  // Border & Background
                  colorBorder: '#E5E7EB',
                  colorBorderSecondary: '#F3F4F6',
                  colorBgContainer: '#FFFFFF',
                  colorBgLayout: '#ffffff',

                  // Text colors
                  colorText: '#111827',
                  colorTextSecondary: '#6B7280',
                  colorTextTertiary: '#9CA3AF',
                  colorTextQuaternary: '#D1D5DB',

                  // Typography - Improved sizes
                  fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  fontSize: 15,
                  fontSizeHeading1: 36,
                  fontSizeHeading2: 30,
                  fontSizeHeading3: 24,
                  fontSizeHeading4: 20,
                  fontSizeHeading5: 18,

                  // Border radius
                  borderRadius: 8,
                  borderRadiusLG: 12,
                  borderRadiusSM: 6,

                  // Shadows
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  boxShadowSecondary: '0 1px 2px rgba(0, 0, 0, 0.05)',
                },
                components: {
                  Layout: {
                    footerPadding: 10,
                    headerBg: '#0f172a',
                    bodyBg: '#ffffff',
                  },
                  Table: {
                    cellPaddingBlock: 10,
                    cellPaddingBlockSM: 8,
                    rowSelectedBg: '#F2ECFF',
                    rowHoverBg: '#FAFAFA',
                    rowSelectedHoverBg: '#E0E7FF',
                    fontSize: 10,
                  },
                  Menu: {
                    itemBg: 'transparent',
                    itemSelectedBg: 'rgba(99, 102, 241, 0.3)',
                    itemSelectedColor: '#818CF8',
                    itemHoverBg: 'rgba(99, 102, 241, 0.15)',
                    itemColor: '#CBD5E1',
                    itemHoverColor: '#ffffff',
                    subMenuItemBg: 'transparent',
                    itemActiveBg: 'rgba(99, 102, 241, 0.25)',
                    fontSize: 14,
                    iconSize: 18,
                  },
                  Button: {
                    primaryShadow: '0 2px 4px rgba(79, 70, 229, 0.3)',
                    fontSize: 14,
                  },
                  Card: {
                    colorBgContainer: '#FFFFFF',
                    paddingLG: 24,
                  },
                  Tag: {
                    defaultBg: '#F3F4F6',
                    defaultColor: '#6B7280',
                    fontSize: 12,
                  },
                  Input: {
                    colorBgContainer: '#FFFFFF',
                    activeBorderColor: '#4F46E5',
                    hoverBorderColor: '#6366F1',
                    fontSize: 14,
                  },
                  Select: {
                    colorBgContainer: '#FFFFFF',
                    optionSelectedBg: '#EEF2FF',
                    fontSize: 14,
                  },
                },
              }}
            >
              <AntdRegistry>
                <App>{children}</App>
              </AntdRegistry>
            </ConfigProvider>
          </ReduxProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
