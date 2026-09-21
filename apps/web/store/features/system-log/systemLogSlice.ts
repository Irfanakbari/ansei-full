/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/
import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {
    get,
    getApiErrorMessage,
    type ApiSuccessEnvelope,
    type PaginatedApiSuccessEnvelope
} from '../../utils/apiService';

export interface ActionAuditEvent {
    Id: string;
    SourceType: string;
    SourceId: string;
    Action: string;
    Actor: string | null;
    ActorName: string;
    ActorSource: string;
    RequestId: string | null;
    ProcessId: string | null;
    Before: Record<string, unknown> | null;
    After: Record<string, unknown> | null;
    CreatedAt: string;
}

export interface ActionAuditQuery {
    page?: number;
    limit?: number;
    processId?: string;
    requestId?: string;
    sourceType?: string;
    sourceId?: string;
    action?: string;
    from?: string;
    to?: string;
}

export const fetchActionAudit = createAsyncThunk<PaginatedApiSuccessEnvelope<ActionAuditEvent>, ActionAuditQuery, {
    rejectValue: string
}>(
    'systemLog/actions', async (query, {rejectWithValue}) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<ActionAuditEvent>>('/system-log/actions', {params: {...query}});
        } catch (error) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to load action audit'));
        }
    },
);

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

export type SystemLogEventType = 'PROCESS' | 'ACTION' | 'INTEGRATION';

export interface SystemLogEvent {
    id: string;
    type: SystemLogEventType;
    occurredAt: string;
    event: string;
    referenceType: string | null;
    referenceId: string | null;
    status: string;
    actor: string | null;
    actorName: string;
    processId: string | null;
    summary: string;
    recoverable: boolean;
}

export interface FetchSystemLogEventsParams {
    page?: number;
    limit?: number;
    type?: SystemLogEventType;
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
    events: SystemLogEvent[];
    eventsTotal: number;
    eventsPage: number;
    eventsLimit: number;
    eventsTotalPages: number;
    eventsLoading: boolean;
    eventsError: string | null;
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
    events: [],
    eventsTotal: 0,
    eventsPage: 1,
    eventsLimit: 50,
    eventsTotalPages: 0,
    eventsLoading: false,
    eventsError: null,
};

export const fetchSystemLogEvents = createAsyncThunk<PaginatedApiSuccessEnvelope<SystemLogEvent>, FetchSystemLogEventsParams | undefined, {
    rejectValue: string
}>(
    'systemLog/fetchEvents',
    async (params = {}, {rejectWithValue}) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<SystemLogEvent>>('/system-log/events', {params: {...params}});
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch system log events'));
        }
    },
);

export const fetchSystemLogs = createAsyncThunk(
    'systemLog/fetchAll',
    async (params: FetchSystemLogsParams = {}, {rejectWithValue}) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<LogProcessDto>>('/system-log', {params: {...params}});
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
            .addCase(fetchSystemLogEvents.pending, (state) => {
                state.eventsLoading = true;
                state.eventsError = null;
            })
            .addCase(fetchSystemLogEvents.fulfilled, (state, action) => {
                state.eventsLoading = false;
                state.events = Array.isArray(action.payload?.data) ? action.payload.data : [];
                state.eventsTotal = action.payload?.meta?.totalItems ?? 0;
                state.eventsPage = action.payload?.meta?.page ?? 1;
                state.eventsLimit = action.payload?.meta?.limit ?? 50;
                state.eventsTotalPages = action.payload?.meta?.totalPages ?? 0;
            })
            .addCase(fetchSystemLogEvents.rejected, (state, action) => {
                state.eventsLoading = false;
                state.eventsError = action.payload ?? 'Failed to fetch system log events';
            })
            // Fetch list
            .addCase(fetchSystemLogs.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchSystemLogs.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
                state.total = action.payload?.meta?.totalItems ?? 0;
                state.page = action.payload?.meta?.page ?? 1;
                state.limit = action.payload?.meta?.limit ?? 50;
                state.totalPages = action.payload?.meta?.totalPages ?? 0;
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
