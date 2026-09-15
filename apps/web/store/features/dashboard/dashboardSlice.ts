/* By Irfan Akbari Vuteq Indonesia - 2026-07-20 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { ApiSuccessEnvelope } from '@/store/utils/apiService';

export interface DashboardQuery {
    month: number;
    year: number;
}

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
    errorStatus: number | null;
}

const initialState: DashboardState = {
    data: null,
    loading: false,
    error: null,
    errorStatus: null,
};

// Fetch dashboard data
export const fetchDashboard = createAsyncThunk<
    DashboardData,
    DashboardQuery | undefined,
    { rejectValue: { message: string; status: number | null } }
>(
    'dashboard/fetch',
    async (query: DashboardQuery | undefined, { rejectWithValue }) => {
        try {
            const searchParams = new URLSearchParams();
            if (query) {
                searchParams.set('month', String(query.month));
                searchParams.set('year', String(query.year));
            }
            const queryString = searchParams.toString();
            const response = await fetch(
                `/api/frontend/dashboard${queryString ? `?${queryString}` : ''}`,
            );
            const envelope = (await response.json()) as
                | ApiSuccessEnvelope<DashboardData>
                | DashboardData
                | { message?: string };
            if (!response.ok) {
                return rejectWithValue({
                    message: envelope && 'message' in envelope && envelope.message
                        ? envelope.message
                        : 'Gagal mengambil data dashboard',
                    status: response.status,
                });
            }
            // Unwrap the global success envelope: { success, data, ... }
            const data =
                typeof envelope === 'object' && envelope !== null && 'success' in envelope
                    ? (envelope as ApiSuccessEnvelope<DashboardData>).data
                    : (envelope as DashboardData);
            return data;
        } catch (error: unknown) {
            return rejectWithValue({
                message: error instanceof Error ? error.message : 'Gagal mengambil data dashboard',
                status: null,
            });
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
                state.error = null;
                state.errorStatus = null;
                state.data = action.payload;
            })
            .addCase(fetchDashboard.rejected, (state, action) => {
                state.loading = false;
                const payload = action.payload as { message?: string; status?: number | null } | undefined;
                state.error = payload?.message || 'Gagal mengambil data dashboard';
                state.errorStatus = payload?.status ?? null;
            });
    },
});

export default dashboardSlice.reducer;
