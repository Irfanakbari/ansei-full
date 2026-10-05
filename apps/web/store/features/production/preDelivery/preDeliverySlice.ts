/*By Irfan Akbari Vuteq Indonesia - 2026-06-08 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { get, getApiErrorMessage, type ApiSuccessEnvelope } from '@/store/utils/apiService';

// PreDelivery entity interface
export interface PreDeliveryEntity {
    id: number;
    labelNumber: string;
    finishGoodId: string;
    finishGoodName: string;
    forecastId: string;
    vendorName: string;
    scanned: boolean;
    qtyThisBox: number;
    productionReleaseId: string;
    productionReleaseNumber: string;
    deliveryDate: string;
}

// Query params interface
export interface PreDeliveryQuery {
    page?: number;
    limit?: number;
    productionReleaseId?: string;
    forecastId?: string;
    finishGoodId?: string;
    labelNumber?: string;
    scanned?: boolean;
    activeReleaseOnly?: boolean;
}

// Paginated response
export interface PaginatedPreDelivery {
    data: PreDeliveryEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// PreDelivery state
interface PreDeliveryState {
    data: PreDeliveryEntity[];
    loading: boolean;
    error: string | null;
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    filters: PreDeliveryQuery;
}

const initialState: PreDeliveryState = {
    data: [],
    loading: false,
    error: null,
    pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
    },
    filters: {
        page: 1,
        limit: 50,
        activeReleaseOnly: true,
    },
};

// Fetch all pre delivery goods
export const fetchPreDelivery = createAsyncThunk<PaginatedPreDelivery, PreDeliveryQuery, { rejectValue: string }>(
    'preDelivery/fetchAll',
    async (filters: PreDeliveryQuery, { rejectWithValue }) => {
        try {
            const response = await get<ApiSuccessEnvelope<PaginatedPreDelivery>>('/production/pre-delivery', {
                params: { ...filters, page: filters.page ?? 1, limit: filters.limit ?? 50 },
            });
            return response.data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch pre delivery goods'));
        }
    }
);

const preDeliverySlice = createSlice({
    name: 'preDelivery',
    initialState,
    reducers: {
        setFilters: (state, action) => {
            state.filters = { ...state.filters, ...action.payload };
        },
        resetFilters: (state) => {
            state.filters = {
                page: 1,
                limit: 50,
            };
        },
        setPage: (state, action) => {
            state.filters.page = action.payload;
        },
        setLimit: (state, action) => {
            state.filters.limit = action.payload;
            state.filters.page = 1;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchPreDelivery.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPreDelivery.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
                state.pagination = {
                    page: action.payload.page || 1,
                    limit: action.payload.limit || 50,
                    total: action.payload.total || 0,
                    totalPages: action.payload.totalPages || 0,
                };
            })
            .addCase(fetchPreDelivery.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { setFilters, resetFilters, setPage, setLimit } = preDeliverySlice.actions;
export default preDeliverySlice.reducer;