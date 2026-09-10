/* By Irfan Akbari Vuteq Indonesia - 2026-07-21 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '@/store/utils/fetchWithAuth';

export interface DisplayConfigEntity {
    Id: number;
    Description: string;
    Url: string;
    IsOpen: boolean;
    Loop: boolean;
    CreatedAt: string;
    UpdatedAt: string;
}

export interface CreateDisplayConfigDto {
    description: string;
    url: string;
    isOpen: boolean;
    loop: boolean;
}

export interface UpdateDisplayConfigDto {
    description?: string;
    url?: string;
    isOpen?: boolean;
    loop?: boolean;
}

interface DisplayConfigState {
    data: DisplayConfigEntity[];
    loading: boolean;
    error: string | null;
}

const initialState: DisplayConfigState = {
    data: [],
    loading: false,
    error: null,
};

export const fetchDisplayConfig = createAsyncThunk(
    'displayConfig/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/settings/display-config');
            const data = await response.json();
            if (!response.ok) {
                return rejectWithValue(data?.message || 'Failed to fetch display configs');
            }
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const createDisplayConfig = createAsyncThunk(
    'displayConfig/create',
    async (payload: CreateDisplayConfigDto, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/settings/display-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) {
                return rejectWithValue(data?.message || 'Failed to create display config');
            }
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const updateDisplayConfig = createAsyncThunk(
    'displayConfig/update',
    async ({ id, data: payload }: { id: number; data: UpdateDisplayConfigDto }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/settings/display-config/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) {
                return rejectWithValue(data?.message || 'Failed to update display config');
            }
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteDisplayConfig = createAsyncThunk(
    'displayConfig/delete',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/settings/display-config/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                return rejectWithValue(data?.message || 'Failed to delete display config');
            }
            return { Id: id };
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const displayConfigSlice = createSlice({
    name: 'displayConfig',
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch all
            .addCase(fetchDisplayConfig.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchDisplayConfig.fulfilled, (state, action) => {
                state.loading = false;
                const payload = action.payload;
                if (Array.isArray(payload)) {
                    state.data = payload;
                } else if (payload && typeof payload === 'object' && 'data' in payload) {
                    state.data = (payload as any).data || [];
                } else {
                    state.data = [];
                }
            })
            .addCase(fetchDisplayConfig.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Create
            .addCase(createDisplayConfig.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createDisplayConfig.fulfilled, (state) => {
                state.loading = false;
            })
            .addCase(createDisplayConfig.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Update
            .addCase(updateDisplayConfig.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateDisplayConfig.fulfilled, (state) => {
                state.loading = false;
            })
            .addCase(updateDisplayConfig.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Delete
            .addCase(deleteDisplayConfig.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(deleteDisplayConfig.fulfilled, (state, action) => {
                state.loading = false;
                state.data = state.data.filter(item => item.Id !== action.payload.Id);
            })
            .addCase(deleteDisplayConfig.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearError } = displayConfigSlice.actions;
export default displayConfigSlice.reducer;
