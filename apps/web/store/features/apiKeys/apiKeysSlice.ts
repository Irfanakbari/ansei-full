/* By Irfan Akbari Vuteq Indonesia - 2026-07-20 */
import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {
    del,
    get,
    getApiErrorMessage,
    patch,
    post,
    type ApiSuccessEnvelope,
    type PaginatedApiSuccessEnvelope,
    type PaginationMeta
} from '../../utils/apiService';

export interface ApiKeyEntity {
    Id: string;
    Name: string;
    KeyPrefix: string;
    Description: string;
    UserId: string;
    User?: {
        UserId: string;
        Name: string;
        Email: string;
        IsActive: boolean;
    };
    IsActive: boolean;
    LastUsedAt: string | null;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string;
    UpdatedAt: string;
    UpdatedBy: string | null;
    UpdatedByName?: string | null;
}

export interface CreateApiKeyPayload {
    userId: string;
    name: string;
    description?: string;
}

interface ApiKeyState {
    data: ApiKeyEntity[];
    singleData: ApiKeyEntity | null;
    newApiKey: { ApiKey: string; KeyPrefix: string; Id: string; Name: string } | null;
    loading: boolean;
    error: string | null;
    pagination: PaginationMeta;
}

const initialState: ApiKeyState = {
    data: [],
    singleData: null,
    newApiKey: null,
    loading: false,
    error: null,
    pagination: {page: 1, limit: 50, totalItems: 0, totalPages: 0},
};

export interface ApiKeyQuery {
    page?: number;
    limit?: number;
    search?: string;
    userId?: string;
    isActive?: boolean
}

export const fetchApiKeys = createAsyncThunk<PaginatedApiSuccessEnvelope<ApiKeyEntity>, ApiKeyQuery | undefined, {
    rejectValue: string
}>(
    'apiKeys/fetchAll',
    async (params = {}, {rejectWithValue}) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<ApiKeyEntity>>('/api-keys', {params: {...params}});
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch API Keys'));
        }
    }
);

export const fetchApiKeyById = createAsyncThunk<ApiSuccessEnvelope<ApiKeyEntity>, string, { rejectValue: string }>(
    'apiKeys/fetchById',
    async (id: string, {rejectWithValue}) => {
        try {
            return await get<ApiSuccessEnvelope<ApiKeyEntity>>(`/api-keys/${id}`);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch API Key'));
        }
    }
);

export const createApiKey = createAsyncThunk<ApiSuccessEnvelope<{
    ApiKey: string;
    KeyPrefix: string;
    Id: string;
    Name: string
}>, CreateApiKeyPayload, { rejectValue: string }>(
    'apiKeys/create',
    async (payload: CreateApiKeyPayload, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<{
                ApiKey: string;
                KeyPrefix: string;
                Id: string;
                Name: string
            }>, CreateApiKeyPayload>('/api-keys', payload);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create API Key'));
        }
    }
);

export const deleteApiKey = createAsyncThunk<string, string, { rejectValue: string }>(
    'apiKeys/delete',
    async (id: string, {rejectWithValue}) => {
        try {
            await del<ApiSuccessEnvelope<unknown>>(`/api-keys/${id}`);
            return id;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete API Key'));
        }
    }
);

export const revokeApiKey = createAsyncThunk<ApiSuccessEnvelope<ApiKeyEntity>, string, { rejectValue: string }>(
    'apiKeys/revoke',
    async (id: string, {rejectWithValue}) => {
        try {
            return await patch<ApiSuccessEnvelope<ApiKeyEntity>>(`/api-keys/${id}/revoke`, {});
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to revoke API Key'));
        }
    }
);

export const reactivateApiKey = createAsyncThunk<ApiSuccessEnvelope<ApiKeyEntity>, string, { rejectValue: string }>(
    'apiKeys/reactivate',
    async (id: string, {rejectWithValue}) => {
        try {
            return await patch<ApiSuccessEnvelope<ApiKeyEntity>>(`/api-keys/${id}/reactivate`, {});
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to reactivate API Key'));
        }
    }
);

const apiKeysSlice = createSlice({
    name: 'apiKeys',
    initialState,
    reducers: {
        clearNewApiKey: (state) => {
            state.newApiKey = null;
        },
        clearSingleData: (state) => {
            state.singleData = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // fetchAll
            .addCase(fetchApiKeys.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchApiKeys.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
                state.pagination = action.payload.meta ?? initialState.pagination;
            })
            .addCase(fetchApiKeys.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // fetchById
            .addCase(fetchApiKeyById.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchApiKeyById.fulfilled, (state, action) => {
                state.loading = false;
                state.singleData = action.payload.data;
            })
            .addCase(fetchApiKeyById.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // create
            .addCase(createApiKey.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createApiKey.fulfilled, (state, action) => {
                state.loading = false;
                state.newApiKey = action.payload.data;
            })
            .addCase(createApiKey.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // delete
            .addCase(deleteApiKey.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteApiKey.fulfilled, (state, action) => {
                state.loading = false;
                state.data = state.data.filter(item => item.Id !== action.payload);
            })
            .addCase(deleteApiKey.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // revoke
            .addCase(revokeApiKey.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(revokeApiKey.fulfilled, (state, action) => {
                state.loading = false;
                const index = state.data.findIndex(item => item.Id === action.payload.data.Id);
                if (index !== -1) {
                    state.data[index] = action.payload.data;
                }
            })
            .addCase(revokeApiKey.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // reactivate
            .addCase(reactivateApiKey.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(reactivateApiKey.fulfilled, (state, action) => {
                state.loading = false;
                const index = state.data.findIndex(item => item.Id === action.payload.data.Id);
                if (index !== -1) {
                    state.data[index] = action.payload.data;
                }
            })
            .addCase(reactivateApiKey.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const {clearNewApiKey, clearSingleData} = apiKeysSlice.actions;
export default apiKeysSlice.reducer;
