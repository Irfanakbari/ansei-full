/*By Irfan Akbari Vuteq Indonesia - 2026-06-08 - Updated 2026-06-16*/
import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {
    del,
    get,
    getApiErrorMessage,
    downloadFile,
    patch,
    post,
    postFormData,
    type ApiSuccessEnvelope,
    type PaginatedApiSuccessEnvelope
} from '@/store/utils/apiService';

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
    ProductionRelease?: { ReleaseNumber: string } | null;
    Status: string;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string;
    PartData: FGData;
}

// Forecast state
interface ForecastState {
    data: ForecastEntity[];
    detail: ForecastEntity | null;
    loading: boolean;
    detailLoading: boolean;
    error: string | null;
    query: ForecastQuery;
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}

export interface ForecastQuery {
    page?: number;
    limit?: number;
    search?: string;
    deliveryDateFrom?: string;
    deliveryDateTo?: string;
}

const initialState: ForecastState = {
    data: [],
    detail: null,
    loading: false,
    detailLoading: false,
    error: null,
    query: {page: 1, limit: 50},
    pagination: {page: 1, limit: 50, totalItems: 0, totalPages: 0},
};

// Fetch all forecasts
export const fetchForecast = createAsyncThunk<PaginatedApiSuccessEnvelope<ForecastEntity>, ForecastQuery | undefined, {
    rejectValue: string
}>(
    'forecast/fetchAll',
    async (query = {}, {rejectWithValue}) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<ForecastEntity>>('/production/forecast', {params: {...query}});
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch forecast data'));
        }
    }
);

// Fetch forecast by ID
export const fetchForecastById = createAsyncThunk(
    'forecast/fetchById',
    async (id: number, {rejectWithValue}) => {
        try {
            return await get<ApiSuccessEnvelope<ForecastEntity>>(`/production/forecast/${id}`);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch forecast detail'));
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
    }, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<ForecastEntity>, typeof forecastData>('/production/forecast', forecastData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create forecast'));
        }
    }
);

// Update forecast
export const updateForecast = createAsyncThunk(
    'forecast/update',
    async ({id, data: updateData}: {
        id: number;
        data: {
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
    }, {rejectWithValue}) => {
        try {
            return await patch<ApiSuccessEnvelope<ForecastEntity>, typeof updateData>(`/production/forecast/${id}`, updateData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update forecast'));
        }
    }
);

// Delete forecast
export const deleteForecast = createAsyncThunk(
    'forecast/delete',
    async (id: number, {rejectWithValue}) => {
        try {
            await del<ApiSuccessEnvelope<unknown>>(`/production/forecast/${id}`);
            return id;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete forecast'));
        }
    }
);

// Clear detail
export const clearForecastDetail = createAsyncThunk(
    'forecast/clearDetail',
    async () => {
    }
);

// Import forecasts from Excel
export const importForecast = createAsyncThunk(
    'forecast/import',
    async (formData: FormData, {rejectWithValue}) => {
        try {
            return await postFormData<ApiSuccessEnvelope<unknown>>('/production/forecast/import', formData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to import forecast'));
        }
    }
);

// Print tag
export const printForecastTag = createAsyncThunk(
    'forecast/printTag',
    async (id: string, {rejectWithValue}) => {
        try {
            return (await post<ApiSuccessEnvelope<{
                message: string;
                integrationId: string
            }>, undefined>(`/production/forecast/${id}/print-tag`, undefined)).data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to print tag'));
        }
    }
);

export const downloadForecastLabel = createAsyncThunk<void, string, {rejectValue: string}>(
    'forecast/downloadLabel',
    async (id, {rejectWithValue}) => {
        try {
            await downloadFile(
                `/production/forecast/${encodeURIComponent(id)}/download-tag`,
                `forecast-label-${id}.pdf`
            );
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to download label'));
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
        setForecastQuery: (state, action: { payload: ForecastQuery }) => {
            state.query = {...state.query, ...action.payload};
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch all
            .addCase(fetchForecast.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchForecast.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
                state.pagination = action.payload.meta ?? initialState.pagination;
            })
            .addCase(fetchForecast.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Fetch by ID
            .addCase(fetchForecastById.pending, (state) => {
                state.detailLoading = true;
                state.error = null;
            })
            .addCase(fetchForecastById.fulfilled, (state, action) => {
                state.detailLoading = false;
                state.detail = action.payload.data;
            })
            .addCase(fetchForecastById.rejected, (state, action) => {
                state.detailLoading = false;
                state.error = action.payload as string;
            })
            // Create
            .addCase(createForecast.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createForecast.fulfilled, (state, action) => {
                state.loading = false;
                state.data.unshift(action.payload.data);
            })
            .addCase(createForecast.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Update
            .addCase(updateForecast.fulfilled, (state, action) => {
                const index = state.data.findIndex(item => item.Id === action.payload.data.Id);
                if (index !== -1) {
                    state.data[index] = action.payload.data;
                }
            })
            // Delete
            .addCase(deleteForecast.fulfilled, (state, action) => {
                state.data = state.data.filter(item => item.Id !== action.payload);
            })
            // Import
            .addCase(importForecast.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(importForecast.fulfilled, (state) => {
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

export const {clearDetail, setForecastQuery} = forecastSlice.actions;
export default forecastSlice.reducer;
