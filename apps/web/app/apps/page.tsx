/* By Irfan Akbari Vuteq Indonesia - 2026-07-20 */

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, Row, Col, Empty, Result, DatePicker } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import {
    ShoppingCart,
    Factory,
    Groups,
    CallReceived,
    CallMade,
    TrendingUp,
    Assessment,
    Inventory,
} from "@mui/icons-material";
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    AreaChart,
} from "recharts";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import { fetchDashboard } from "@/store/features/dashboard/dashboardSlice";

// Format number with thousand separator
const formatNumber = (num: number): string => {
    return num.toLocaleString("id-ID");
};

// Format date for display
const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.getDate().toString();
};

// Get month name
const getMonthName = (monthStr: string): string => {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString("id-ID", { month: "long", year: "numeric" });
};

// Custom tooltip - defined outside component to avoid ESLint error
interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
        name: string;
        value: number;
        color: string;
    }>;
    label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div
                style={{
                    background: "white",
                    padding: "12px 16px",
                    border: "1px solid #e8e8e8",
                    borderRadius: 8,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                }}
            >
                <p style={{ fontWeight: 600, marginBottom: 8, color: "#1a1a2e" }}>
                    Tanggal {label}
                </p>
                {payload.map((entry, index) => (
                    <p
                        key={index}
                        style={{
                            color: entry.color,
                            fontSize: 13,
                            marginBottom: 4,
                        }}
                    >
                        {entry.name}: {formatNumber(entry.value)} QTY
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// Summary Card Component
interface SummaryCardProps {
    title: string;
    value: number;
    icon: React.ReactNode;
    gradient: string;
    suffix?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
    title,
    value,
    icon,
    gradient,
    suffix = "",
}) => (
    <Card
        styles={{
            body: {
                padding: "20px 24px",
            },
        }}
        style={{
            borderRadius: 16,
            overflow: "hidden",
            position: "relative",
            height: "100%",
        }}
        className="hover:shadow-xl transition-all duration-300 border-0 shadow-md"
    >
        <div
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: gradient,
            }}
        />
        <div className="flex items-center justify-between">
            <div className="flex-1">
                <p
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#8c8c8c",
                        marginBottom: 8,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                    }}
                >
                    {title}
                </p>
                <div
                    style={{
                        fontSize: 26,
                        fontWeight: 700,
                        color: "#1a1a2e",
                        lineHeight: 1.2,
                    }}
                >
                    {formatNumber(value)}
                    {suffix && (
                        <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 4 }}>
                            {suffix}
                        </span>
                    )}
                </div>
            </div>
            <div
                style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: gradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    boxShadow: `0 8px 20px rgba(0,0,0,0.15)`,
                }}
            >
                {icon}
            </div>
        </div>
    </Card>
);

// Mini Stat Card Component
interface MiniStatCardProps {
    title: string;
    value: number;
    color: string;
    icon: React.ReactNode;
}

const MiniStatCard: React.FC<MiniStatCardProps> = ({ title, value, color, icon }) => (
    <Card
        styles={{
            body: {
                padding: "14px 18px",
            },
        }}
        style={{
            borderRadius: 12,
            borderLeft: `4px solid ${color}`,
        }}
        className="hover:shadow-md transition-all duration-300 shadow-sm"
    >
        <div className="flex items-center gap-3">
            <div
                style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: `${color}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: color,
                }}
            >
                {icon}
            </div>
            <div>
                <p style={{ fontSize: 11, color: "#8c8c8c", marginBottom: 2 }}>{title}</p>
                <p style={{ fontSize: 18, fontWeight: 600, color: "#1a1a2e" }}>
                    {formatNumber(value)}
                </p>
            </div>
        </div>
    </Card>
);

// Chart Card Component
interface ChartCardProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    height?: number;
    icon?: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({
    title,
    subtitle,
    children,
    height = 350,
    icon,
}) => (
    <Card
        styles={{
            body: {
                padding: "24px",
            },
        }}
        style={{
            borderRadius: 16,
            height: "100%",
        }}
        className="hover:shadow-xl transition-all duration-300 shadow-md"
    >
        <div className="flex items-center gap-3 mb-5">
            {icon && (
                <div
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                    }}
                >
                    {icon}
                </div>
            )}
            <div>
                <h3
                    style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#1a1a2e",
                        marginBottom: 2,
                    }}
                >
                    {title}
                </h3>
                {subtitle && (
                    <p style={{ fontSize: 12, color: "#8c8c8c" }}>{subtitle}</p>
                )}
            </div>
        </div>
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                {children}
            </ResponsiveContainer>
        </div>
    </Card>
);

// Loading Skeleton
const DashboardSkeleton: React.FC = () => (
    <div className="space-y-6">
        <Row gutter={[16, 16]}>
            {[...Array(6)].map((_, i) => (
                <Col key={i} xs={24} sm={12} lg={8} xl={4}>
                    <Card styles={{ body: { padding: 20 } }} style={{ borderRadius: 16 }}>
                        <div className="animate-pulse space-y-3">
                            <div className="h-3 bg-gray-200 rounded w-24" />
                            <div className="h-7 bg-gray-200 rounded w-16" />
                        </div>
                    </Card>
                </Col>
            ))}
        </Row>
        <Row gutter={[16, 16]}>
            {[...Array(3)].map((_, i) => (
                <Col key={i} xs={24} lg={8}>
                    <Card styles={{ body: { padding: 24 } }} style={{ borderRadius: 16 }}>
                        <div className="animate-pulse space-y-4">
                            <div className="h-5 bg-gray-200 rounded w-48" />
                            <div className="h-72 bg-gray-100 rounded" />
                        </div>
                    </Card>
                </Col>
            ))}
        </Row>
    </div>
);

// Main Dashboard Component
export default function DashboardPage() {
    const dispatch = useDispatch<AppDispatch>();
    const { data, loading, error, errorStatus } = useSelector((state: RootState) => state.dashboard);
    const [selectedPeriod, setSelectedPeriod] = useState<Dayjs>(dayjs());

    useEffect(() => {
        void dispatch(
            fetchDashboard({
                month: selectedPeriod.month() + 1,
                year: selectedPeriod.year(),
            }),
        );
    }, [dispatch, selectedPeriod]);

    // Prepare chart data using useMemo to avoid recalculation
    const combinedChartData = useMemo(() => {
        if (!data) return [];

        const chartData = data.forecastDailyStats.map((forecast) => {
            const incoming = data.incomingDailyStats.find((inc) => inc.date === forecast.date);
            const delivery = data.deliveryDailyStats.find((del) => del.date === forecast.date);

            return {
                date: formatDate(forecast.date),
                fullDate: forecast.date,
                Forecast: forecast.totalQty,
                Incoming: incoming?.totalQty || 0,
                Delivery: delivery?.totalQty || 0,
            };
        });

        // Also include dates from incoming/delivery that might not be in forecast
        data.incomingDailyStats.forEach((incoming) => {
            if (!chartData.find((d) => d.fullDate === incoming.date)) {
                const forecast = data.forecastDailyStats.find(
                    (f) => f.date === incoming.date
                );
                const delivery = data.deliveryDailyStats.find(
                    (d) => d.date === incoming.date
                );
                chartData.push({
                    date: formatDate(incoming.date),
                    fullDate: incoming.date,
                    Forecast: forecast?.totalQty || 0,
                    Incoming: incoming.totalQty,
                    Delivery: delivery?.totalQty || 0,
                });
            }
        });

        data.deliveryDailyStats.forEach((delivery) => {
            if (!chartData.find((d) => d.fullDate === delivery.date)) {
                const forecast = data.forecastDailyStats.find(
                    (f) => f.date === delivery.date
                );
                const incoming = data.incomingDailyStats.find(
                    (i) => i.date === delivery.date
                );
                chartData.push({
                    date: formatDate(delivery.date),
                    fullDate: delivery.date,
                    Forecast: forecast?.totalQty || 0,
                    Incoming: incoming?.totalQty || 0,
                    Delivery: delivery.totalQty,
                });
            }
        });

        // Sort by date
        chartData.sort((a, b) => {
            const dateA = new Date(a.fullDate).getTime();
            const dateB = new Date(b.fullDate).getTime();
            return dateA - dateB;
        });

        return chartData;
    }, [data]);

    if (loading) {
        return (
            <div>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: "#1a1a2e" }}>
                            Dashboard Overview
                        </h1>
                        <p style={{ color: "#8c8c8c" }}>Memuat data dashboard...</p>
                    </div>
                </div>
                <DashboardSkeleton />
            </div>
        );
    }

    if (error) {
        const isAccessError = errorStatus === 401 || errorStatus === 403;
        return (
            <div
                style={{
                    minHeight: "calc(100vh - 180px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {isAccessError ? (
                    <div style={{ textAlign: "center" }}>
                        <h2 style={{ color: "#1a1a2e", marginBottom: 8 }}>
                            Akses Dashboard Ditolak
                        </h2>
                        <p style={{ color: "#8c8c8c", margin: 0 }}>
                            Anda tidak memiliki permission DASHBOARD_VIEW untuk melihat dashboard.
                        </p>
                    </div>
                ) : (
                    <Result
                        status="error"
                        title="Dashboard Tidak Dapat Dimuat"
                        subTitle={`Gagal memuat data dashboard: ${error}`}
                    />
                )}
            </div>
        );
    }

    if (!data) {
        return (
            <Empty description="Tidak ada data dashboard" />
        );
    }

    return (
        // Scrollable container for dashboard content only
        <div style={{ paddingRight: 8 }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1
                        style={{
                            fontSize: 24,
                            fontWeight: 700,
                            marginBottom: 4,
                            color: "#1a1a2e",
                        }}
                    >
                        Dashboard Overview
                    </h1>
                    <p
                        style={{ color: "#8c8c8c", margin: 0 }}
                    >
                        {getMonthName(selectedPeriod.format("YYYY-MM"))} - Data
                        harian dalam bulan ini
                    </p>
                </div>
                <DatePicker
                    picker="month"
                    value={selectedPeriod}
                    onChange={(value) => value && setSelectedPeriod(value)}
                    allowClear={false}
                    format="MMMM YYYY"
                />
            </div>

            {/* Summary Cards */}
            <Row gutter={[16, 16]} className="mb-6">
                <Col xs={24} sm={12} lg={8} xl={4}>
                    <SummaryCard
                        title="Total Materials"
                        value={data.summary.totalMaterials}
                        icon={<ShoppingCart />}
                        gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                    />
                </Col>
                <Col xs={24} sm={12} lg={8} xl={4}>
                    <SummaryCard
                        title="Total Suppliers"
                        value={data.summary.totalSuppliers}
                        icon={<Factory />}
                        gradient="linear-gradient(135deg, #f59e0b 0%, #f97316 100%)"
                    />
                </Col>
                <Col xs={24} sm={12} lg={8} xl={4}>
                    <SummaryCard
                        title="Finish Goods"
                        value={data.summary.totalFinishGoods}
                        icon={<Inventory />}
                        gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    />
                </Col>
                <Col xs={24} sm={12} lg={8} xl={4}>
                    <SummaryCard
                        title="Total Man Power"
                        value={data.summary.totalManPower}
                        icon={<Groups />}
                        gradient="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
                    />
                </Col>
                <Col xs={24} sm={12} lg={8} xl={4}>
                    <SummaryCard
                        title="Total Incoming"
                        value={data.summary.totalIncomingQty}
                        icon={<CallReceived />}
                        gradient="linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
                    />
                </Col>
                <Col xs={24} sm={12} lg={8} xl={4}>
                    <SummaryCard
                        title="Total Delivery"
                        value={data.summary.totalDeliveryQty}
                        icon={<CallMade />}
                        gradient="linear-gradient(135deg, #ec4899 0%, #db2777 100%)"
                    />
                </Col>
            </Row>

            {/* Charts Row */}
            <Row gutter={[16, 16]}>
                {/* Main Combined Chart */}
                <Col xs={24} lg={16}>
                    <ChartCard
                        title="Daily Activity Overview"
                        subtitle="Incoming, Delivery & Forecast Quantity"
                        height={380}
                        icon={<TrendingUp />}
                    >
                        <AreaChart data={combinedChartData}>
                            <defs>
                                <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#667eea" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#667eea" stopOpacity={0.05} />
                                </linearGradient>
                                <linearGradient id="colorIncoming" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                                </linearGradient>
                                <linearGradient id="colorDelivery" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#e8e8e8"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#8c8c8c", fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#8c8c8c", fontSize: 12 }}
                                dx={-10}
                                tickFormatter={(value) => formatNumber(value)}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                wrapperStyle={{ paddingTop: 20 }}
                                iconType="circle"
                                iconSize={10}
                            />
                            <Area
                                type="monotone"
                                dataKey="Forecast"
                                stroke="#667eea"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorForecast)"
                                dot={{ r: 4, fill: "#667eea", strokeWidth: 2, stroke: "white" }}
                                activeDot={{ r: 6, fill: "#667eea", strokeWidth: 2, stroke: "white" }}
                            />
                            <Area
                                type="monotone"
                                dataKey="Incoming"
                                stroke="#10b981"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorIncoming)"
                                dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "white" }}
                                activeDot={{ r: 6, fill: "#10b981", strokeWidth: 2, stroke: "white" }}
                            />
                            <Area
                                type="monotone"
                                dataKey="Delivery"
                                stroke="#ec4899"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorDelivery)"
                                dot={{ r: 4, fill: "#ec4899", strokeWidth: 2, stroke: "white" }}
                                activeDot={{ r: 6, fill: "#ec4899", strokeWidth: 2, stroke: "white" }}
                            />
                        </AreaChart>
                    </ChartCard>
                </Col>

                {/* Mini Stats */}
                <Col xs={24} lg={8}>
                    <Card
                        styles={{
                            body: {
                                padding: "24px",
                                height: "100%",
                            },
                        }}
                        style={{
                            borderRadius: 16,
                            height: "100%",
                        }}
                        className="shadow-md"
                    >
                        <div className="flex items-center gap-3 mb-5">
                            <div
                                style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 10,
                                    background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "white",
                                }}
                            >
                                <Assessment fontSize="small" />
                            </div>
                            <div>
                                <h3
                                    style={{
                                        fontSize: 15,
                                        fontWeight: 600,
                                        color: "#1a1a2e",
                                        marginBottom: 2,
                                    }}
                                >
                                    Quick Summary
                                </h3>
                                <p style={{ fontSize: 12, color: "#8c8c8c" }}>
                                    {getMonthName(data.currentMonth)}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <MiniStatCard
                                title="Forecast Count"
                                value={data.forecastDailyStats.reduce(
                                    (acc, curr) => acc + curr.count,
                                    0
                                )}
                                color="#667eea"
                                icon={<TrendingUp fontSize="small" />}
                            />
                            <MiniStatCard
                                title="Total Forecast Qty"
                                value={data.forecastDailyStats.reduce(
                                    (acc, curr) => acc + curr.totalQty,
                                    0
                                )}
                                color="#8b5cf6"
                                icon={<ShoppingCart fontSize="small" />}
                            />
                            <MiniStatCard
                                title="Total Incoming Qty"
                                value={data.incomingDailyStats.reduce(
                                    (acc, curr) => acc + curr.totalQty,
                                    0
                                )}
                                color="#10b981"
                                icon={<CallReceived fontSize="small" />}
                            />
                            <MiniStatCard
                                title="Total Delivery Qty"
                                value={data.deliveryDailyStats.reduce(
                                    (acc, curr) => acc + curr.totalQty,
                                    0
                                )}
                                color="#ec4899"
                                icon={<CallMade fontSize="small" />}
                            />
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Individual Charts Row */}
            <Row gutter={[16, 16]} className="mt-6 mb-6">
                {/* Forecast Chart */}
                <Col xs={24} md={8}>
                    <ChartCard
                        title="Forecast"
                        subtitle="Planning quantity per day"
                        height={300}
                        icon={<TrendingUp />}
                    >
                        <AreaChart data={combinedChartData}>
                            <defs>
                                <linearGradient id="colorForecastSolo" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#667eea" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#667eea" stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" vertical={false} />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#8c8c8c", fontSize: 11 }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#8c8c8c", fontSize: 11 }}
                                tickFormatter={(value) => formatNumber(value)}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="Forecast"
                                stroke="#667eea"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorForecastSolo)"
                            />
                        </AreaChart>
                    </ChartCard>
                </Col>

                {/* Incoming Chart */}
                <Col xs={24} md={8}>
                    <ChartCard
                        title="Incoming"
                        subtitle="Incoming quantity per day"
                        height={300}
                        icon={<CallReceived />}
                    >
                        <AreaChart data={combinedChartData}>
                            <defs>
                                <linearGradient id="colorIncomingSolo" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" vertical={false} />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#8c8c8c", fontSize: 11 }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#8c8c8c", fontSize: 11 }}
                                tickFormatter={(value) => formatNumber(value)}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="Incoming"
                                stroke="#10b981"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorIncomingSolo)"
                            />
                        </AreaChart>
                    </ChartCard>
                </Col>

                {/* Delivery Chart */}
                <Col xs={24} md={8}>
                    <ChartCard
                        title="Delivery"
                        subtitle="Delivery quantity per day"
                        height={300}
                        icon={<CallMade />}
                    >
                        <AreaChart data={combinedChartData}>
                            <defs>
                                <linearGradient id="colorDeliverySolo" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" vertical={false} />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#8c8c8c", fontSize: 11 }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#8c8c8c", fontSize: 11 }}
                                tickFormatter={(value) => formatNumber(value)}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="Delivery"
                                stroke="#ec4899"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorDeliverySolo)"
                            />
                        </AreaChart>
                    </ChartCard>
                </Col>
            </Row>
        </div>
    );
}
