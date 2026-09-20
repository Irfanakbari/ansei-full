/*By Irfan Akbari Vuteq Indonesia - 2026-06-09 - Updated 2026-06-16*/
import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {
    get,
    getApiErrorMessage,
    post,
    type ApiSuccessEnvelope,
    type PaginatedApiSuccessEnvelope,
} from '@/store/utils/apiService';

// Pokayoke scan entity interface
export interface PokayokeScanEntity {
    id: number;
    labelNumber: string;
    poId: string;
    partNumber: string;
    partName: string;
    status: 'SUKSES' | 'GAGAL';
    createdAt: string;
    createdBy: string;
    createdByName?: string;
}

// Scan response interface
export interface PokayokeScanResponse {
    success: boolean;
    message: string;
    data?: PokayokeScanEntity;
    error?: string;
}

// Scan request interface
export interface PokayokeScanRequest {
    labelNumber: string;
    status: PokayokeScanEntity['status'];
}

export interface PokayokeScanOption {
    id: number;
    labelNumber: string;
    forecastId: string;
    finishGoodId: string;
    finishGoodName: string;
    qtyThisBox: number;
    productionReleaseId: string;
    productionReleaseNumber: string;
    requiresAssembly: boolean;
}

export interface PokayokeScanOptionsResponse {
    labels: PokayokeScanOption[];
}

// Pokayoke state
interface PokayokeState {
    data: PokayokeScanEntity[];
    loading: boolean;
    scanning: boolean;
    error: string | null;
    scanResult: PokayokeScanResponse | null;
    pagination: { page: number; limit: number; total: number; totalPages: number };
    filters: PokayokeQuery;
}

export interface PokayokeQuery {
    page?: number;
    limit?: number;
    labelNumber?: string;
    poId?: string;
    status?: PokayokeScanEntity['status'];
    createdBy?: string;
}

interface PaginatedPokayoke {
    data: PokayokeScanEntity[];
    meta: {
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
    };
}

const initialState: PokayokeState = {
    data: [],
    loading: false,
    scanning: false,
    error: null,
    scanResult: null,
    pagination: {page: 1, limit: 50, total: 0, totalPages: 0},
    filters: {page: 1, limit: 50},
};

// Fetch all pokayoke scans
export const fetchPokayoke = createAsyncThunk<PaginatedPokayoke, PokayokeQuery, { rejectValue: string }>(
    'pokayoke/fetchAll',
    async (filters, {rejectWithValue}) => {
        try {
            const response = await get<PaginatedApiSuccessEnvelope<PokayokeScanEntity>>('/production/pokayoke', {
                params: {...filters, page: filters.page ?? 1, limit: filters.limit ?? 50},
            });
            return {data: response.data, meta: response.meta};
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch pokayoke data'));
        }
    }
);

// Scan pokayoke
export const fetchPokayokeScanOptions = createAsyncThunk<
    PokayokeScanOptionsResponse,
    string | undefined,
    { rejectValue: string }
>('pokayoke/fetchScanOptions', async (search, {rejectWithValue}) => {
    try {
        const response = await get<ApiSuccessEnvelope<PokayokeScanOptionsResponse>>(
            '/production/pokayoke/scan-options',
            {params: {labelNumber: search}},
        );
        return response.data;
    } catch (error: unknown) {
        return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch scan options'));
    }
});

export const scanPokayoke = createAsyncThunk<
    PokayokeScanResponse,
    PokayokeScanRequest,
    { rejectValue: string }
>(
    'pokayoke/scan',
    async (scanData: PokayokeScanRequest, {rejectWithValue}) => {
        try {
            const data = await post<PokayokeScanResponse, PokayokeScanRequest>(
                '/production/pokayoke/scan',
                scanData,
            );
            if (data.success === false) {
                return rejectWithValue(data.message || data.error || 'Scan failed');
            }
            return data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to scan pokayoke'));
        }
    }
);

const pokayokeSlice = createSlice({
    name: 'pokayoke',
    initialState,
    reducers: {
        setFilters: (state, action) => {
            state.filters = {...state.filters, ...action.payload};
        },
        clearScanResult: (state) => {
            state.scanResult = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch all
            .addCase(fetchPokayoke.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPokayoke.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
                state.pagination = {
                    page: action.payload.meta.page,
                    limit: action.payload.meta.limit,
                    total: action.payload.meta.totalItems,
                    totalPages: action.payload.meta.totalPages,
                };
            })
            .addCase(fetchPokayoke.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Scan
            .addCase(scanPokayoke.pending, (state) => {
                state.scanning = true;
                state.error = null;
            })
            .addCase(scanPokayoke.fulfilled, (state, action) => {
                state.scanning = false;
                state.scanResult = action.payload;
            })
            .addCase(scanPokayoke.rejected, (state, action) => {
                state.scanning = false;
                state.error = action.payload as string;
            });
    },
});

export const {clearScanResult, setFilters} = pokayokeSlice.actions;
export default pokayokeSlice.reducer;