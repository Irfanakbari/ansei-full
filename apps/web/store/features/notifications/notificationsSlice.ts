/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { withBasePath } from '@/lib/base-path';

// Incoming not closed interface
export interface IncomingNotClosed {
    id: string;
    poId: string;
    description: string;
    receivedBy: string;
    supplierName?: string;
    createdAt: string;
}

// Forecast without attachment interface
export interface ForecastWithoutAttachment {
    poId: string;
    poNumber: string;
    partNumber?: string | null;
    partName?: string | null;
    qty: number;
    deliveryDate: string;
}

// Production release without attachment interface
export interface ProductionReleaseWithoutAttachment {
    releaseId: string;
    releaseNumber: string;
    status: string;
    count: number;
    forecasts: ForecastWithoutAttachment[];
}

// Notifications response interface
export interface StockOpnameInProgress {
    id: string;
    opnameNumber: string;
    category?: string;
    startedAt?: string;
}

export interface LabelDataNotScanned {
    id: number;
    labelNumber: string;
    releaseId?: string;
    releaseNumber?: string;
}

export interface NotificationMessage {
    menu: 'INCOMING' | 'PRODUCTION_PLAN' | 'STOCK_OPNAME' | 'POKAYOKE' | 'ASSEMBLY';
    message: string;
}

export interface AssemblyInProgress {
    id: string;
    labelNumber?: string | null;
    manpowerName?: string | null;
    startedAt?: string | null;
}

export interface NotificationsEntity {
    totalPOWithoutAttachment: number;
    byProductionRelease: ProductionReleaseWithoutAttachment[];
    totalIncomingNotClosed: number;
    incomingNotClosed: IncomingNotClosed[];
    totalStockOpnameInProgress: number;
    stockOpnameInProgress: StockOpnameInProgress[];
    totalLabelDataNotScanned: number;
    labelDataNotScanned: LabelDataNotScanned[];
    totalAssemblyInProgress: number;
    assemblyInProgress: AssemblyInProgress[];
    messages: NotificationMessage[];
}

// Notifications state
export interface NotificationsState {
    data: NotificationsEntity | null;
    loading: boolean;
    error: string | null;
}

const initialState: NotificationsState = {
    data: null,
    loading: false,
    error: null,
};

// Fetch notifications through the authenticated Next.js proxy
export const fetchNotifications = createAsyncThunk<
    NotificationsEntity,
    void,
    { rejectValue: string }
>(
    'notifications/fetch',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetch(withBasePath('/api/frontend/notifications'));
            const result: unknown = await response.json();
            if (!response.ok) {
                const message = typeof result === 'object' && result !== null && 'message' in result && typeof result.message === 'string'
                    ? result.message
                    : 'Gagal mengambil data notifications';
                return rejectWithValue(message);
            }
            // Backend returns ApiSuccessEnvelope: { success: true, statusCode: 200, message: "...", data: NotificationsEntity }
            const payload = result && typeof result === 'object' && 'data' in result
                ? result.data
                : result;
            if (!payload || typeof payload !== 'object') {
                return rejectWithValue('Format data notifications tidak valid');
            }
            const data = payload as NotificationsEntity;
            return {
                ...data,
                totalAssemblyInProgress: typeof data.totalAssemblyInProgress === 'number'
                    ? data.totalAssemblyInProgress
                    : 0,
                assemblyInProgress: Array.isArray(data.assemblyInProgress)
                    ? data.assemblyInProgress
                    : [],
            };
        } catch (error: unknown) {
            return rejectWithValue(error instanceof Error ? error.message : 'Gagal mengambil data notifications');
        }
    }
);

const notificationsSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        clearNotifications: (state) => {
            state.data = null;
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchNotifications.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchNotifications.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload;
            })
            .addCase(fetchNotifications.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Gagal mengambil data notifications';
            });
    },
});

export const { clearNotifications } = notificationsSlice.actions;
export default notificationsSlice.reducer;
