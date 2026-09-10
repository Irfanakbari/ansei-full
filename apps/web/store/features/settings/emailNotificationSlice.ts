/*By Irfan Akbari Vuteq Indonesia - 2026-07-14*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '@/store/utils/fetchWithAuth';

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
}

const initialState: EmailNotificationState = {
    data: [],
    loading: false,
    error: null,
};

// Fetch all email notifications
export const fetchEmailNotifications = createAsyncThunk(
    'emailNotification/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/settings/email-notification');
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch email notifications');
            return Array.isArray(data) ? data : (data.data || []);
            return Array.isArray(data) ? data : (data.data || []);
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Create email notification
export const createEmailNotification = createAsyncThunk(
    'emailNotification/create',
    async (data: { name: string; email: string; type?: NotificationType }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/settings/email-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) return rejectWithValue(result.message || 'Failed to create email notification');
            return result;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Update email notification
export const updateEmailNotification = createAsyncThunk(
    'emailNotification/update',
    async ({ id, data }: { id: number; data: { name?: string; email?: string; type?: NotificationType } }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/settings/email-notification/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) return rejectWithValue(result.message || 'Failed to update email notification');
            return result;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Delete email notification
export const deleteEmailNotification = createAsyncThunk(
    'emailNotification/delete',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/settings/email-notification/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete email notification');
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const emailNotificationSlice = createSlice({
    name: 'emailNotification',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Fetch all
            .addCase(fetchEmailNotifications.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchEmailNotifications.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload;
            })
            .addCase(fetchEmailNotifications.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Create
            .addCase(createEmailNotification.pending, (state) => { state.loading = true; })
            .addCase(createEmailNotification.fulfilled, (state, action) => {
                state.loading = false;
                state.data.unshift(action.payload);
            })
            .addCase(createEmailNotification.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Update
            .addCase(updateEmailNotification.fulfilled, (state, action) => {
                const index = state.data.findIndex(item => item.Id === action.payload.Id);
                if (index !== -1) {
                    state.data[index] = action.payload;
                }
            })
            // Delete
            .addCase(deleteEmailNotification.fulfilled, (state, action) => {
                state.data = state.data.filter(item => item.Id !== action.payload);
            });
    },
});

export default emailNotificationSlice.reducer;
