/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Incoming not closed interface
export interface IncomingNotClosed {
    id: string;
    poId: string;
    description: string;
    receivedBy: string;
    supplierName: string;
    createdAt: string;
}

// Production release without attachment interface
export interface ProductionReleaseWithoutAttachment {
    Id: string;
    ReleaseNumber: string;
    PlanDate: string;
    totalPOCount: number;
}

// Notifications response interface
export interface StockOpnameInProgress {
    id: string;
    opnameNumber: string;
    status: string;
    createdAt: string;
}

export interface LabelDataNotScanned {
    id: number;
    labelNumber: string;
    releaseId: string;
    releaseNumber: string;
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
interface NotificationsState {
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
export const fetchNotifications = createAsyncThunk(
    'notifications/fetch',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetch('/api/frontend/notifications');
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Gagal mengambil data notifications');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const notificationsSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {},
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
                state.error = action.payload as string;
            });
    },
});

export default notificationsSlice.reducer;
