/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/
import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import { get, getApiErrorMessage, type ApiSuccessEnvelope, type PaginatedApiSuccessEnvelope } from '../../utils/apiService';

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
    meta: {
        totalItems: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface FetchSystemLogsParams {
    page?: number;
    limit?: number;
    functionId?: string;
    processStatus?: string;
    search?: string;
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
    async (params: FetchSystemLogsParams = {}, {rejectWithValue}) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<LogProcessDto>>('/system-log', { params: { ...params } });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch system logs'));
        }
    }
);

export const fetchSystemLogDetail = createAsyncThunk(
    'systemLog/fetchDetail',
    async (id: string, {rejectWithValue}) => {
        try {
            return await get<ApiSuccessEnvelope<LogProcessDetailResponseDto>>(`/system-log/${id}`);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch detail'));
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
            .addCase(fetchSystemLogs.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload.data;
                state.total = action.payload.meta.totalItems;
                state.page = action.payload.meta.page;
                state.limit = action.payload.meta.limit;
                state.totalPages = action.payload.meta.totalPages;
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
            .addCase(fetchSystemLogDetail.fulfilled, (state, action) => {
                state.detailLoading = false;
                state.detail = action.payload.data;
            })
            .addCase(fetchSystemLogDetail.rejected, (state, action) => {
                state.detailLoading = false;
                state.error = action.payload as string;
            });
    },
});

export const {clearDetail, clearError} = systemLogSlice.actions;
export default systemLogSlice.reducer;