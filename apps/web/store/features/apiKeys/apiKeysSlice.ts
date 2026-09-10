/* By Irfan Akbari Vuteq Indonesia - 2026-07-20 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
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
}

const initialState: ApiKeyState = {
    data: [],
    singleData: null,
    newApiKey: null,
    loading: false,
    error: null,
};

export const fetchApiKeys = createAsyncThunk(
    'apiKeys/fetchAll',
    async (params: { userId?: string; isActive?: string } | undefined, { rejectWithValue }) => {
        try {
            let url = '/api/api-keys';
            const queryParams = new URLSearchParams();
            if (params?.userId) queryParams.append('userId', params.userId);
            if (params?.isActive) queryParams.append('isActive', params.isActive);
            if (queryParams.toString()) url += `?${queryParams.toString()}`;

            const response = await fetchWithAuth(url);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch API Keys');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
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
                state.data = action.payload || [];
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
