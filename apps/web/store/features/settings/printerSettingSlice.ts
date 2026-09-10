/*By Irfan Akbari Vuteq Indonesia - 2026-07-14*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '@/store/utils/fetchWithAuth';

// PrinterSetting entity interface
export interface PrinterSettingEntity {
    Id: string;
    Name: string | null;
    IpAddress: string;
    CreatedAt: string;
    CreatedBy: string;
    UpdatedAt: string;
    UpdatedBy: string | null;
}

// PrinterSetting state
interface PrinterSettingState {
    data: PrinterSettingEntity[];
    loading: boolean;
    error: string | null;
}

const initialState: PrinterSettingState = {
    data: [],
    loading: false,
    error: null,
};

// Fetch all printer settings
export const fetchPrinterSettings = createAsyncThunk(
    'printerSetting/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/settings/printer-setting');
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch printer settings');
            return Array.isArray(data) ? data : (data.data || []);
            return Array.isArray(data) ? data : (data.data || []);
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Create printer setting
export const createPrinterSetting = createAsyncThunk(
    'printerSetting/create',
    async (data: { name?: string; ipAddress: string }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/settings/printer-setting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) return rejectWithValue(result.message || 'Failed to create printer setting');
            return result;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Update printer setting
export const updatePrinterSetting = createAsyncThunk(
    'printerSetting/update',
    async ({ id, data }: { id: string; data: { name?: string; ipAddress?: string } }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/settings/printer-setting/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) return rejectWithValue(result.message || 'Failed to update printer setting');
            return result;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Delete printer setting
export const deletePrinterSetting = createAsyncThunk(
    'printerSetting/delete',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/settings/printer-setting/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete printer setting');
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const printerSettingSlice = createSlice({
    name: 'printerSetting',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Fetch all
            .addCase(fetchPrinterSettings.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchPrinterSettings.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload;
            })
            .addCase(fetchPrinterSettings.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Create
            .addCase(createPrinterSetting.pending, (state) => { state.loading = true; })
            .addCase(createPrinterSetting.fulfilled, (state, action) => {
                state.loading = false;
                state.data.unshift(action.payload);
            })
            .addCase(createPrinterSetting.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Update
            .addCase(updatePrinterSetting.fulfilled, (state, action) => {
                const index = state.data.findIndex(item => item.Id === action.payload.Id);
                if (index !== -1) {
                    state.data[index] = action.payload;
                }
            })
            // Delete
            .addCase(deletePrinterSetting.fulfilled, (state, action) => {
                state.data = state.data.filter(item => item.Id !== action.payload);
            });
    },
});

export default printerSettingSlice.reducer;
