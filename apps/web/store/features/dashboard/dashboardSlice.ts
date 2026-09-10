/* By Irfan Akbari Vuteq Indonesia - 2026-07-20 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Interfaces
export interface ForecastDailyStat {
    date: string;
    count: number;
    totalQty: number;
}

export interface IncomingDailyStat {
    date: string;
    totalQty: number;
}

export interface DeliveryDailyStat {
    date: string;
    totalQty: number;
}

export interface DashboardSummary {
    totalMaterials: number;
    totalSuppliers: number;
    totalFinishGoods: number;
    totalManPower: number;
    totalIncomingQty: number;
    totalDeliveryQty: number;
}

export interface DashboardData {
    summary: DashboardSummary;
    forecastDailyStats: ForecastDailyStat[];
    incomingDailyStats: IncomingDailyStat[];
    deliveryDailyStats: DeliveryDailyStat[];
    currentMonth: string;
    daysInMonth: number;
}

// State interface
interface DashboardState {
    data: DashboardData | null;
    loading: boolean;
    error: string | null;
}

const initialState: DashboardState = {
    data: null,
    loading: false,
    error: null,
};

// Fetch dashboard data
export const fetchDashboard = createAsyncThunk(
    'dashboard/fetch',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/frontend/dashboard');
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Gagal mengambil data dashboard');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const dashboardSlice = createSlice({
    name: 'dashboard',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchDashboard.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchDashboard.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload;
            })
            .addCase(fetchDashboard.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export default dashboardSlice.reducer;
