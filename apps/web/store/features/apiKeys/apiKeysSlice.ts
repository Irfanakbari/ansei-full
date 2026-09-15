/* By Irfan Akbari Vuteq Indonesia - 2026-07-20 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { get, getApiErrorMessage, type PaginatedApiSuccessEnvelope, type PaginationMeta } from '../../utils/apiService';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

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
    pagination: { page: 1, limit: 50, totalItems: 0, totalPages: 0 },
};

export interface ApiKeyQuery { page?: number; limit?: number; search?: string; userId?: string; isActive?: boolean }

export const fetchApiKeys = createAsyncThunk<PaginatedApiSuccessEnvelope<ApiKeyEntity>, ApiKeyQuery | undefined, { rejectValue: string }>(
    'apiKeys/fetchAll',
    async (params = {}, { rejectWithValue }) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<ApiKeyEntity>>('/api-keys', { params: { ...params } });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch API Keys'));
        }
    }
);

export const fetchApiKeyById = createAsyncThunk(
    'apiKeys/fetchById',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/api-keys/${id}`);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch API Key');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const createApiKey = createAsyncThunk(
    'apiKeys/create',
    async (payload: CreateApiKeyPayload, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to create API Key');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteApiKey = createAsyncThunk(
    'apiKeys/delete',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/api-keys/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                return rejectWithValue(data.message || 'Failed to delete API Key');
            }
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const revokeApiKey = createAsyncThunk(
    'apiKeys/revoke',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/api-keys/${id}/revoke`, {
                method: 'PATCH',
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to revoke API Key');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const reactivateApiKey = createAsyncThunk(
    'apiKeys/reactivate',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/api-keys/${id}/reactivate`, {
                method: 'PATCH',
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to reactivate API Key');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
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
            .addCase(fetchApiKeys.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchApiKeys.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload.data;
                state.pagination = action.payload.meta;
            })
            .addCase(fetchApiKeys.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // fetchById
            .addCase(fetchApiKeyById.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchApiKeyById.fulfilled, (state, action) => {
                state.loading = false;
                state.singleData = action.payload;
            })
            .addCase(fetchApiKeyById.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // create
            .addCase(createApiKey.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(createApiKey.fulfilled, (state, action) => {
                state.loading = false;
                state.newApiKey = action.payload;
            })
            .addCase(createApiKey.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // delete
            .addCase(deleteApiKey.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(deleteApiKey.fulfilled, (state, action) => {
                state.loading = false;
                state.data = state.data.filter(item => item.Id !== action.payload);
            })
            .addCase(deleteApiKey.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // revoke
            .addCase(revokeApiKey.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(revokeApiKey.fulfilled, (state, action) => {
                state.loading = false;
                const index = state.data.findIndex(item => item.Id === action.payload.Id);
                if (index !== -1) {
                    state.data[index] = action.payload;
                }
            })
            .addCase(revokeApiKey.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // reactivate
            .addCase(reactivateApiKey.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(reactivateApiKey.fulfilled, (state, action) => {
                state.loading = false;
                const index = state.data.findIndex(item => item.Id === action.payload.Id);
                if (index !== -1) {
                    state.data[index] = action.payload;
                }
            })
            .addCase(reactivateApiKey.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearNewApiKey, clearSingleData } = apiKeysSlice.actions;
export default apiKeysSlice.reducer;
