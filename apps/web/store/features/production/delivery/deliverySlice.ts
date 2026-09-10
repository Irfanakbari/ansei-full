/*By Irfan Akbari Vuteq Indonesia - 2026-06-10 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '@/store/utils/fetchWithAuth';

// Delivery entity interface
export interface DeliveryEntity {
    id: number;
    forecastId: string;
    qty: number;
    createdAt: string;
    createdBy: string;
    labelDataId: string;
}

// Delivery response interface
export interface DeliveryResponse {
    success: boolean;
    message: string;
    data?: DeliveryEntity;
    error?: string;
}

// Query params interface
export interface DeliveryQuery {
    page?: number;
    limit?: number;
    forecastId?: string;
    createdBy?: string;
}

// Create delivery request interface
export interface CreateDeliveryRequest {
    labelDataId: number;
}

// Paginated response
export interface PaginatedDelivery {
    data: DeliveryEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// Delivery state
interface DeliveryState {
    data: DeliveryEntity[];
    loading: boolean;
    creating: boolean;
    error: string | null;
    createResult: DeliveryResponse | null;
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    filters: DeliveryQuery;
}

const initialState: DeliveryState = {
    data: [],
    loading: false,
    creating: false,
    error: null,
    createResult: null,
    pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
    },
    filters: {
        page: 1,
        limit: 50,
    },
};

// Fetch all deliveries
export const fetchDelivery = createAsyncThunk(
    'delivery/fetchAll',
    async (filters: DeliveryQuery, { rejectWithValue }) => {
        try {
            // Build query string
            const params = new URLSearchParams();
            if (filters.page) params.append('page', String(filters.page));
            if (filters.limit) params.append('limit', String(filters.limit));
            if (filters.forecastId) params.append('forecastId', filters.forecastId);
            if (filters.createdBy) params.append('createdBy', filters.createdBy);

            const queryString = params.toString();
            const url = `/api/production/delivery${queryString ? `?${queryString}` : ''}`;

            const response = await fetchWithAuth(url);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch delivery data');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Create delivery
export const createDelivery = createAsyncThunk(
    'delivery/create',
    async (deliveryData: CreateDeliveryRequest, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/production/delivery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deliveryData),
            });
            const data = await response.json();

            // Handle HTTP errors
            if (!response.ok) {
                return rejectWithValue(data.message || 'Failed to create delivery');
            }

            // Handle business logic errors (HTTP 200 but success: false)
            if (data.success === false) {
                return rejectWithValue(data.message || data.error || 'Delivery failed');
            }

            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const deliverySlice = createSlice({
    name: 'delivery',
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
        clearCreateResult: (state) => {
            state.createResult = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch all
            .addCase(fetchDelivery.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchDelivery.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload.data || [];
                state.pagination = {
                    page: action.payload.page || 1,
                    limit: action.payload.limit || 50,
                    total: action.payload.total || 0,
                    totalPages: action.payload.totalPages || 0,
                };
            })
            .addCase(fetchDelivery.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Create
            .addCase(createDelivery.pending, (state) => {
                state.creating = true;
                state.error = null;
            })
            .addCase(createDelivery.fulfilled, (state, action) => {
                state.creating = false;
                state.createResult = action.payload;
            })
            .addCase(createDelivery.rejected, (state, action) => {
                state.creating = false;
                state.error = action.payload as string;
            });
    },
});

export const { setFilters, resetFilters, clearCreateResult } = deliverySlice.actions;
export default deliverySlice.reducer;