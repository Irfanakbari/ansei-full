/*By Irfan Akbari Vuteq Indonesia - 2026-06-08 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '@/store/utils/fetchWithAuth';

// Part type enum
export type PartType = 'ONE' | 'TWO' | 'THREE' | 'FOUR';

// Part type options
export const PART_TYPE_OPTIONS: { value: PartType; label: string }[] = [
    { value: 'ONE', label: 'ONE' },
    { value: 'TWO', label: 'TWO' },
    { value: 'THREE', label: 'THREE' },
    { value: 'FOUR', label: 'FOUR' },
];

// ManPower data interface
export interface ManPowerData {
    Uid: string;
    Nik: string;
    Name: string;
}

// Finish Good data interface
export interface FGData {
    PartNumber: string;
    PartName: string;
}

// Production report entity interface
export interface ProductionReportEntity {
    id: number;
    date: string;
    time: string | null;
    productionStamp: string;
    ngQty: number;
    startTime: string | null;
    startStamp: string | null;
    endTime: string | null;
    endStamp: string | null;
    stopMinute: number;
    recordType: PartType;
    qty: number;
    manPowerUid: string;
    finishGoodId: string;
    validatedAt: string | null;
    validatedBy: string | null;
    manPowerData: ManPowerData | null;
    fgData: FGData | null;
}

// Query params interface
export interface ProductionReportQuery {
    page?: number;
    limit?: number;
    date?: string;
    manPowerUid?: string;
    finishGoodId?: string;
    recordType?: PartType;
    isValidated?: boolean;
}

// Paginated response
export interface PaginatedProductionReport {
    data: ProductionReportEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// Production report state
interface ProductionReportState {
    data: ProductionReportEntity[];
    loading: boolean;
    error: string | null;
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    filters: ProductionReportQuery;
}

const initialState: ProductionReportState = {
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
    },
};

// Fetch all production reports
export const fetchProductionReport = createAsyncThunk(
    'productionReport/fetchAll',
    async (filters: ProductionReportQuery, { rejectWithValue }) => {
        try {
            // Build query string
            const params = new URLSearchParams();
            if (filters.page) params.append('page', String(filters.page));
            if (filters.limit) params.append('limit', String(filters.limit));
            if (filters.date) params.append('date', filters.date);
            if (filters.manPowerUid) params.append('manPowerUid', filters.manPowerUid);
            if (filters.finishGoodId) params.append('finishGoodId', filters.finishGoodId);
            if (filters.recordType) params.append('recordType', filters.recordType);
            if (filters.isValidated !== undefined) params.append('isValidated', String(filters.isValidated));

            const queryString = params.toString();
            const url = `/api/production/production-report${queryString ? `?${queryString}` : ''}`;

            const response = await fetchWithAuth(url);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch production report');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Validate production report
export const validateProductionReport = createAsyncThunk(
    'productionReport/validate',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/production/production-report/${id}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to validate production report');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Unvalidate production report
export const unvalidateProductionReport = createAsyncThunk(
    'productionReport/unvalidate',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/production/production-report/${id}/unvalidate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to unvalidate production report');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Delete production report
export const deleteProductionReport = createAsyncThunk(
    'productionReport/delete',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/production/production-report/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete production report');
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const productionReportSlice = createSlice({
    name: 'productionReport',
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
            state.filters.page = 1; // Reset to first page when changing limit
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch all
            .addCase(fetchProductionReport.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchProductionReport.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload.data || [];
                state.pagination = {
                    page: action.payload.page || 1,
                    limit: action.payload.limit || 50,
                    total: action.payload.total || 0,
                    totalPages: action.payload.totalPages || 0,
                };
            })
            .addCase(fetchProductionReport.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Validate
            .addCase(validateProductionReport.fulfilled, (state, action) => {
                const index = state.data.findIndex(item => item.id === action.payload.id);
                if (index !== -1) {
                    state.data[index] = action.payload;
                }
            })
            .addCase(validateProductionReport.rejected, (state, action) => {
                state.error = action.payload as string;
            })
            // Unvalidate
            .addCase(unvalidateProductionReport.fulfilled, (state, action) => {
                const index = state.data.findIndex(item => item.id === action.payload.id);
                if (index !== -1) {
                    state.data[index] = action.payload;
                }
            })
            .addCase(unvalidateProductionReport.rejected, (state, action) => {
                state.error = action.payload as string;
            })
            // Delete
            .addCase(deleteProductionReport.fulfilled, (state, action) => {
                state.data = state.data.filter(item => item.id !== action.payload);
            })
            .addCase(deleteProductionReport.rejected, (state, action) => {
                state.error = action.payload as string;
            });
    },
});

export const { setFilters, resetFilters, setPage, setLimit } = productionReportSlice.actions;
export default productionReportSlice.reducer;