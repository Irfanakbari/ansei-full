/*By Irfan Akbari Vuteq Indonesia - 2026-06-08 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {fetchWithAuth} from "@/store/utils/fetchWithAuth";

// FG Data interface
export interface FGData {
    PartNumber: string;
    PartName: string;
}

// Forecast entity interface
export interface ForecastEntity {
    Id: number;
    PoId: string;
    Date: string;
    VendorCode: string;
    VendorName: string;
    ReceivingArea: string;
    DeliveryDate: string;
    DeliveryPeriod: number;
    Classification: string;
    PoNumber: string;
    Item: number;
    Qty: number;
    FinishGoodId: string;
    ProductionReleaseId: string | null;
    Status: string;
    CreatedAt: string;
    CreatedBy: string;
    PartData: FGData;
}

// Forecast state
interface ForecastState {
    data: ForecastEntity[];
    detail: ForecastEntity | null;
    loading: boolean;
    detailLoading: boolean;
    error: string | null;
}

const initialState: ForecastState = {
    data: [],
    detail: null,
    loading: false,
    detailLoading: false,
    error: null,
};

// Fetch all forecasts
export const fetchForecast = createAsyncThunk(
    'forecast/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/production/forecast');
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch forecast data');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Fetch forecast by ID
export const fetchForecastById = createAsyncThunk(
    'forecast/fetchById',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/production/forecast/${id}`);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch forecast detail');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Create forecast
export const createForecast = createAsyncThunk(
    'forecast/create',
    async (forecastData: {
        poId: string;
        date: string;
        vendorCode: string;
        vendorName: string;
        receivingArea: string;
        deliveryDate: string;
        deliveryPeriod: number;
        classification: string;
        poNumber: string;
        item: number;
        qty: number;
        finishGoodId: string;
    }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/production/forecast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(forecastData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to create forecast');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Update forecast
export const updateForecast = createAsyncThunk(
    'forecast/update',
    async ({ id, data: updateData }: {
        id: number;
        data: {
            status?: string;
            poId?: string;
            date?: string;
            vendorCode?: string;
            vendorName?: string;
            receivingArea?: string;
            deliveryDate?: string;
            deliveryPeriod?: number;
            classification?: string;
            poNumber?: string;
            item?: number;
            qty?: number;
            finishGoodId?: string;
        }
    }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/production/forecast/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to update forecast');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Delete forecast
export const deleteForecast = createAsyncThunk(
    'forecast/delete',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/production/forecast/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete forecast');
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Clear detail
export const clearForecastDetail = createAsyncThunk(
    'forecast/clearDetail',
    async () => {}
);

// Import forecasts from Excel
export const importForecast = createAsyncThunk(
    'forecast/import',
    async (formData: FormData, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/production/forecast/import', {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to import forecast');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Print tag
export const printForecastTag = createAsyncThunk(
    'forecast/printTag',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/production/forecast/${id}/print-tag`, {
                method: 'POST',
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to print tag');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const forecastSlice = createSlice({
    name: 'forecast',
    initialState,
    reducers: {
        clearDetail: (state) => {
            state.detail = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch all
            .addCase(fetchForecast.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchForecast.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
            })
            .addCase(fetchForecast.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Fetch by ID
            .addCase(fetchForecastById.pending, (state) => { state.detailLoading = true; state.error = null; })
            .addCase(fetchForecastById.fulfilled, (state, action) => {
                state.detailLoading = false;
                state.detail = action.payload;
            })
            .addCase(fetchForecastById.rejected, (state, action) => {
                state.detailLoading = false;
                state.error = action.payload as string;
            })
            // Create
            .addCase(createForecast.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(createForecast.fulfilled, (state, action) => {
                state.loading = false;
                state.data.unshift(action.payload);
            })
            .addCase(createForecast.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Update
            .addCase(updateForecast.fulfilled, (state, action) => {
                const index = state.data.findIndex(item => item.Id === action.payload.Id);
                if (index !== -1) {
                    state.data[index] = action.payload;
                }
            })
            // Delete
            .addCase(deleteForecast.fulfilled, (state, action) => {
                state.data = state.data.filter(item => item.Id !== action.payload);
            })
            // Import
            .addCase(importForecast.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(importForecast.fulfilled, (state, action) => {
                state.loading = false;
                // Refresh data after import
            })
            .addCase(importForecast.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Clear detail
            .addCase(clearForecastDetail.fulfilled, (state) => {
                state.detail = null;
            });
    },
});

export const { clearDetail } = forecastSlice.actions;
export default forecastSlice.reducer;