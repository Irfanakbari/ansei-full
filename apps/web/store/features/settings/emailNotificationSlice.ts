/*By Irfan Akbari Vuteq Indonesia - 2026-07-14*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { del, get, getApiErrorMessage, patch, post, type ApiSuccessEnvelope, type PaginatedApiSuccessEnvelope } from '@/store/utils/apiService';

// NotificationType enum
export type NotificationType = 'DEFAULT' | 'INCOMING' | 'OUTGOING' | 'PRODUCTION' | 'TRANSFER';

// EmailNotification entity interface
export interface EmailNotificationEntity {
    Id: number;
    Name: string;
    Email: string;
    Type: NotificationType;
    CreatedAt: string;
    CreatedBy: string;
    UpdatedAt: string;
    UpdatedBy: string | null;
}

// EmailNotification state
interface EmailNotificationState {
    data: EmailNotificationEntity[];
    loading: boolean;
    error: string | null;
    query: EmailNotificationQuery;
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}
export interface EmailNotificationQuery { page?: number; limit?: number; search?: string }

const initialState: EmailNotificationState = {
    data: [],
    loading: false,
    error: null,
    query: { page: 1, limit: 50 },
    pagination: { page: 1, limit: 50, totalItems: 0, totalPages: 0 },
};

// Fetch all email notifications
export const fetchEmailNotifications = createAsyncThunk<PaginatedApiSuccessEnvelope<EmailNotificationEntity>, EmailNotificationQuery | undefined, { rejectValue: string }>(
    'emailNotification/fetchAll',
    async (query = {}, { rejectWithValue }) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<EmailNotificationEntity>>('/settings/email-notification', { params: { ...query } });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch email notifications'));
        }
    }
);

// Create email notification
export const createEmailNotification = createAsyncThunk(
    'emailNotification/create',
    async (data: { name: string; email: string; type?: NotificationType }, { rejectWithValue }) => {
        try {
            return await post<ApiSuccessEnvelope<EmailNotificationEntity>, typeof data>('/settings/email-notification', data);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create email notification'));
        }
    }
);

// Update email notification
export const updateEmailNotification = createAsyncThunk(
    'emailNotification/update',
    async ({ id, data }: { id: number; data: { name?: string; email?: string; type?: NotificationType } }, { rejectWithValue }) => {
        try {
            return await patch<ApiSuccessEnvelope<EmailNotificationEntity>, typeof data>(`/settings/email-notification/${id}`, data);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update email notification'));
        }
    }
);

// Delete email notification
export const deleteEmailNotification = createAsyncThunk(
    'emailNotification/delete',
    async (id: number, { rejectWithValue }) => {
        try {
            await del<ApiSuccessEnvelope<unknown>>(`/settings/email-notification/${id}`);
            return id;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete email notification'));
        }
    }
);

const emailNotificationSlice = createSlice({
    name: 'emailNotification',
    initialState,
    reducers: { setEmailNotificationQuery: (state, action: { payload: EmailNotificationQuery }) => { state.query = { ...state.query, ...action.payload }; } },
    extraReducers: (builder) => {
        builder
            // Fetch all
            .addCase(fetchEmailNotifications.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchEmailNotifications.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload.data;
                state.pagination = action.payload.meta;
            })
            .addCase(fetchEmailNotifications.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Create
            .addCase(createEmailNotification.pending, (state) => { state.loading = true; })
            .addCase(createEmailNotification.fulfilled, (state, action) => {
                state.loading = false;
                state.data.unshift(action.payload.data);
            })
            .addCase(createEmailNotification.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Update
            .addCase(updateEmailNotification.fulfilled, (state, action) => {
                const index = state.data.findIndex(item => item.Id === action.payload.data.Id);
                if (index !== -1) {
                    state.data[index] = action.payload.data;
                }
            })
            // Delete
            .addCase(deleteEmailNotification.fulfilled, (state, action) => {
                state.data = state.data.filter(item => item.Id !== action.payload);
            });
    },
});

export const { setEmailNotificationQuery } = emailNotificationSlice.actions;
export default emailNotificationSlice.reducer;
