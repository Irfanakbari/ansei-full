/* By Irfan Akbari Vuteq Indonesia - 2026-09-28 */

import {createAsyncThunk, createSlice} from "@reduxjs/toolkit";
import {
    get,
    getApiErrorMessage,
    post,
    type ApiSuccessEnvelope,
    type PaginatedApiSuccessEnvelope,
    type PaginationMeta,
} from "@/store/utils/apiService";

export type PrintAgentStatus = "ACTIVE" | "DISABLED";
export type PrintAgentConnectionStatus = "ONLINE" | "OFFLINE";

export interface PrintAgentEntity {
    Id: string;
    Name: string;
    Status: PrintAgentStatus;
    displayStatus: PrintAgentConnectionStatus;
    Version: string | null;
    ProfilesCount: number;
    LastHeartbeatAt: string | null;
    CreatedAt: string;
    CreatedBy: string;
    UpdatedAt: string;
    UpdatedBy: string;
}

export interface PrintAgentQuery {
    page?: number;
    limit?: number;
    search?: string;
    status?: PrintAgentStatus;
}

export interface EnrollmentToken {
    token: string;
    expiresAt: string | null;
}

type PrintAgentState = {
    data: PrintAgentEntity[];
    selected: PrintAgentEntity | null;
    query: PrintAgentQuery;
    pagination: PaginationMeta;
    listLoading: boolean;
    detailLoading: boolean;
    createLoading: boolean;
    enrollmentLoading: boolean;
    listError: string | null;
    detailError: string | null;
    createError: string | null;
    enrollmentError: string | null;
};

const initialState: PrintAgentState = {
    data: [],
    selected: null,
    query: {page: 1, limit: 50},
    pagination: {page: 1, limit: 50, totalItems: 0, totalPages: 0},
    listLoading: false,
    detailLoading: false,
    createLoading: false,
    enrollmentLoading: false,
    listError: null,
    detailError: null,
    createError: null,
    enrollmentError: null,
};

export const fetchPrintAgents = createAsyncThunk<PaginatedApiSuccessEnvelope<PrintAgentEntity>, PrintAgentQuery | undefined, {rejectValue: string}>(
    "printAgent/fetchAll",
    async (query = {}, {rejectWithValue}) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<PrintAgentEntity>>("/settings/print-agents", {params: {...query}});
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to fetch print agents"));
        }
    },
);

export const fetchPrintAgent = createAsyncThunk<ApiSuccessEnvelope<PrintAgentEntity>, string, {rejectValue: string}>(
    "printAgent/fetchOne",
    async (id, {rejectWithValue}) => {
        try {
            return await get<ApiSuccessEnvelope<PrintAgentEntity>>(`/settings/print-agents/${id}`);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to fetch print agent"));
        }
    },
);

export const createPrintAgent = createAsyncThunk<ApiSuccessEnvelope<PrintAgentEntity>, {name: string}, {rejectValue: string}>(
    "printAgent/create",
    async (payload, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<PrintAgentEntity>, typeof payload>("/settings/print-agents", payload);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to create print agent"));
        }
    },
);

export const createPrintAgentEnrollment = createAsyncThunk<ApiSuccessEnvelope<EnrollmentToken>, {id: string}, {rejectValue: string}>(
    "printAgent/createEnrollment",
    async ({id}, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<EnrollmentToken>, Record<string, never>>(
                `/settings/print-agents/${id}/enrollments`,
                {},
            );
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to generate enrollment token"));
        }
    },
);

const printAgentSlice = createSlice({
    name: "printAgent",
    initialState,
    reducers: {
        setPrintAgentQuery: (state, action: {payload: PrintAgentQuery}) => {
            state.query = {...state.query, ...action.payload};
        },
        clearSelectedPrintAgent: (state) => {
            state.selected = null;
            state.detailError = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchPrintAgents.pending, (state) => {
                state.listLoading = true;
                state.listError = null;
            })
            .addCase(fetchPrintAgents.fulfilled, (state, action) => {
                state.listLoading = false;
                state.data = Array.isArray(action.payload.data) ? action.payload.data : [];
                state.pagination = action.payload.meta;
            })
            .addCase(fetchPrintAgents.rejected, (state, action) => {
                state.listLoading = false;
                state.listError = action.payload ?? "Failed to fetch print agents";
            })
            .addCase(fetchPrintAgent.pending, (state) => {
                state.detailLoading = true;
                state.detailError = null;
                state.selected = null;
            })
            .addCase(fetchPrintAgent.fulfilled, (state, action) => {
                state.detailLoading = false;
                state.selected = action.payload.data;
            })
            .addCase(fetchPrintAgent.rejected, (state, action) => {
                state.detailLoading = false;
                state.detailError = action.payload ?? "Failed to fetch print agent";
            })
            .addCase(createPrintAgent.pending, (state) => {
                state.createLoading = true;
                state.createError = null;
            })
            .addCase(createPrintAgent.fulfilled, (state) => {
                state.createLoading = false;
            })
            .addCase(createPrintAgent.rejected, (state, action) => {
                state.createLoading = false;
                state.createError = action.payload ?? "Failed to create print agent";
            })
            .addCase(createPrintAgentEnrollment.pending, (state) => {
                state.enrollmentLoading = true;
                state.enrollmentError = null;
            })
            .addCase(createPrintAgentEnrollment.fulfilled, (state) => {
                state.enrollmentLoading = false;
            })
            .addCase(createPrintAgentEnrollment.rejected, (state, action) => {
                state.enrollmentLoading = false;
                state.enrollmentError = action.payload ?? "Failed to generate enrollment token";
            });
    },
});

export const {clearSelectedPrintAgent, setPrintAgentQuery} = printAgentSlice.actions;
export default printAgentSlice.reducer;
