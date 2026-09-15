/*By Irfan Akbari Vuteq Indonesia - 2026-07-14*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { del, get, getApiErrorMessage, patch, post, type ApiSuccessEnvelope, type PaginatedApiSuccessEnvelope } from '@/store/utils/apiService';

// PrinterSetting entity interface
export interface PrinterSettingEntity {
    Id: string;
    Name: string | null;
    IpAddress: string;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string;
    UpdatedAt: string;
    UpdatedBy: string | null;
    UpdatedByName?: string | null;
}

// PrinterSetting state
interface PrinterSettingState {
    data: PrinterSettingEntity[];
    loading: boolean;
    error: string | null;
    query: SettingsQuery;
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}
export interface SettingsQuery { page?: number; limit?: number; search?: string }

const initialState: PrinterSettingState = {
    data: [],
    loading: false,
    error: null,
    query: { page: 1, limit: 50 },
    pagination: { page: 1, limit: 50, totalItems: 0, totalPages: 0 },
};

// Fetch all printer settings
export const fetchPrinterSettings = createAsyncThunk<PaginatedApiSuccessEnvelope<PrinterSettingEntity>, SettingsQuery | undefined, { rejectValue: string }>(
    'printerSetting/fetchAll',
    async (query = {}, { rejectWithValue }) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<PrinterSettingEntity>>('/settings/printer-setting', { params: { ...query } });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch printer settings'));
        }
    }
);

// Create printer setting
export const createPrinterSetting = createAsyncThunk(
    'printerSetting/create',
    async (data: { name?: string; ipAddress: string }, { rejectWithValue }) => {
        try {
            return await post<ApiSuccessEnvelope<PrinterSettingEntity>, typeof data>('/settings/printer-setting', data);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create printer setting'));
        }
    }
);

// Update printer setting
export const updatePrinterSetting = createAsyncThunk(
    'printerSetting/update',
    async ({ id, data }: { id: string; data: { name?: string; ipAddress?: string } }, { rejectWithValue }) => {
        try {
            return await patch<ApiSuccessEnvelope<PrinterSettingEntity>, typeof data>(`/settings/printer-setting/${id}`, data);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update printer setting'));
        }
    }
);

// Delete printer setting
export const deletePrinterSetting = createAsyncThunk(
    'printerSetting/delete',
    async (id: string, { rejectWithValue }) => {
        try {
            await del<ApiSuccessEnvelope<unknown>>(`/settings/printer-setting/${id}`);
            return id;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete printer setting'));
        }
    }
);

const printerSettingSlice = createSlice({
    name: 'printerSetting',
    initialState,
    reducers: { setPrinterSettingQuery: (state, action: { payload: SettingsQuery }) => { state.query = { ...state.query, ...action.payload }; } },
    extraReducers: (builder) => {
        builder
            // Fetch all
            .addCase(fetchPrinterSettings.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchPrinterSettings.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
                state.pagination = action.payload.meta ?? initialState.pagination;
            })
            .addCase(fetchPrinterSettings.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Create
            .addCase(createPrinterSetting.pending, (state) => { state.loading = true; })
            .addCase(createPrinterSetting.fulfilled, (state, action) => {
                state.loading = false;
                state.data.unshift(action.payload.data);
            })
            .addCase(createPrinterSetting.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Update
            .addCase(updatePrinterSetting.fulfilled, (state, action) => {
                const index = state.data.findIndex(item => item.Id === action.payload.data.Id);
                if (index !== -1) {
                    state.data[index] = action.payload.data;
                }
            })
            // Delete
            .addCase(deletePrinterSetting.fulfilled, (state, action) => {
                state.data = state.data.filter(item => item.Id !== action.payload);
            });
    },
});

export const { setPrinterSettingQuery } = printerSettingSlice.actions;
export default printerSettingSlice.reducer;
