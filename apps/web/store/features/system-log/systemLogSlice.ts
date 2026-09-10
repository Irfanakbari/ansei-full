/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

export interface LogProcessDto {
    processId: string;
    functionId: string;
    functionName: string;
    processStatus: string;
    processDate: string | null;
    processStart: string | null;
    processEnd: string | null;
    createdAt: string;
}

export interface LogProcessDetailDto {
    id: number;
    processId: string;
    messageId: string;
    message: string;
    type: string;
    location: string;
    processDate: string | null;
    createdAt: string;
}

export interface LogProcessDetailResponseDto extends LogProcessDto {
    details: LogProcessDetailDto[];
}

export interface PaginatedLogProcessDto {
    data: LogProcessDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface FetchSystemLogsParams {
    page?: number;
    limit?: number;
    functionId?: string;
    processStatus?: string;
}

interface SystemLogState {
    data: LogProcessDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    loading: boolean;
    detailLoading: boolean;
    detail: LogProcessDetailResponseDto | null;
    error: string | null;
}

const initialState: SystemLogState = {
    data: [],
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0,
    loading: false,
    detailLoading: false,
    detail: null,
    error: null,
};

export const fetchSystemLogs = createAsyncThunk(
    'systemLog/fetchAll',
    async (params: FetchSystemLogsParams = {}, { rejectWithValue }) => {
        try {
            const query = new URLSearchParams();
            if (params.page) query.set('page', String(params.page));
            if (params.limit) query.set('limit', String(params.limit));
            if (params.functionId) query.set('functionId', params.functionId);
            if (params.processStatus) query.set('processStatus', params.processStatus);

            const response = await fetchWithAuth(`/api/system-log?${query.toString()}`);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch system logs');
            return data as PaginatedLogProcessDto;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to fetch system logs');
        }
    }
);

export const fetchSystemLogDetail = createAsyncThunk(
    'systemLog/fetchDetail',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/system-log/${id}`);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch detail');
            return data as LogProcessDetailResponseDto;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to fetch detail');
        }
    }
);

const systemLogSlice = createSlice({
    name: 'systemLog',
    initialState,
    reducers: {
        clearDetail: (state) => {
            state.detail = null;
        },
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch list
            .addCase(fetchSystemLogs.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchSystemLogs.fulfilled, (state, action: PayloadAction<PaginatedLogProcessDto>) => {
                state.loading = false;
                state.data = action.payload.data;
                state.total = action.payload.total;
                state.page = action.payload.page;
                state.limit = action.payload.limit;
                state.totalPages = action.payload.totalPages;
            })
            .addCase(fetchSystemLogs.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Fetch detail
            .addCase(fetchSystemLogDetail.pending, (state) => {
                state.detailLoading = true;
                state.error = null;
            })
            .addCase(fetchSystemLogDetail.fulfilled, (state, action: PayloadAction<LogProcessDetailResponseDto>) => {
                state.detailLoading = false;
                state.detail = action.payload;
            })
            .addCase(fetchSystemLogDetail.rejected, (state, action) => {
                state.detailLoading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearDetail, clearError } = systemLogSlice.actions;
export default systemLogSlice.reducer;