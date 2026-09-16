/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

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
    menu: string;
    message: string;
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

// Fetch notifications (public endpoint - goes through proxy, no auth required)
export const fetchNotifications = createAsyncThunk<
    NotificationsEntity,
    void,
    { rejectValue: string }
>(
    'notifications/fetch',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/frontend/notifications');
            const result = await response.json();
            if (!response.ok) return rejectWithValue(result?.message || 'Gagal mengambil data notifications');
            // Backend returns ApiSuccessEnvelope: { success: true, statusCode: 200, message: "...", data: NotificationsEntity }
            const data: NotificationsEntity =
                result && typeof result === 'object' && 'data' in result && result.data
                    ? result.data
                    : result;
            return data;
        } catch (error: any) {
            return rejectWithValue(error?.message || 'Gagal mengambil data notifications');
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
                const payload = action.payload as any;
                state.data =
                    payload && typeof payload === 'object' && 'data' in payload && payload.data
                        ? payload.data
                        : payload;
            })
            .addCase(fetchNotifications.rejected, (state, action) => {
                state.loading = false;
                state.error = (action.payload as string) || 'Gagal mengambil data notifications';
            });
    },
});

export const { clearNotifications } = notificationsSlice.actions;
export default notificationsSlice.reducer;
