/* By Irfan Akbari Vuteq Indonesia - 2026-07-21 */

import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {
    del,
    get,
    getApiErrorMessage,
    patch,
    postFormData,
    type ApiSuccessEnvelope,
    type PaginatedApiSuccessEnvelope
} from '@/store/utils/apiService';

export interface DisplayConfigEntity {
    Id: number;
    Description: string;
    Url: string | null;
    FilePath: string | null;
    Line: string | null;
    IsOpen: boolean;
    Loop: boolean;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string | null;
    UpdatedAt: string;
    UpdatedBy: string | null;
    UpdatedByName?: string | null;
}

export interface CreateDisplayConfigDto {
    description: string;
    url?: string;
    line?: string;
    isOpen: boolean;
    loop: boolean;
}

export interface UpdateDisplayConfigDto {
    description?: string;
    url?: string;
    line?: string;
    isOpen?: boolean;
    loop?: boolean;
}

interface DisplayConfigState {
    data: DisplayConfigEntity[];
    loading: boolean;
    error: string | null;
    query: DisplayConfigQuery;
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}

export interface DisplayConfigQuery {
    page?: number;
    limit?: number;
    search?: string
}

const initialState: DisplayConfigState = {
    data: [],
    loading: false,
    error: null,
    query: {page: 1, limit: 50},
    pagination: {page: 1, limit: 50, totalItems: 0, totalPages: 0},
};

export const fetchDisplayConfig = createAsyncThunk<PaginatedApiSuccessEnvelope<DisplayConfigEntity>, DisplayConfigQuery | undefined, {
    rejectValue: string
}>(
    'displayConfig/fetchAll',
    async (query = {}, {rejectWithValue}) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<DisplayConfigEntity>>('/settings/display-config', {params: {...query}});
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch display configs'));
        }
    }
);

export const createDisplayConfig = createAsyncThunk(
    'displayConfig/create',
    async ({data: payload, file}: { data: CreateDisplayConfigDto; file?: File }, {rejectWithValue}) => {
        try {
            const formData = new FormData();
            formData.append('description', payload.description);
            if (payload.url) formData.append('url', payload.url);
            if (payload.line) formData.append('line', payload.line);
            formData.append('isOpen', String(payload.isOpen));
            formData.append('loop', String(payload.loop));
            if (file) formData.append('file', file);
            return await postFormData<ApiSuccessEnvelope<DisplayConfigEntity>>('/settings/display-config', formData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create display config'));
        }
    }
);

export const updateDisplayConfig = createAsyncThunk(
    'displayConfig/update',
    async ({id, data: payload}: { id: number; data: UpdateDisplayConfigDto }, {rejectWithValue}) => {
        try {
            return await patch<ApiSuccessEnvelope<DisplayConfigEntity>, UpdateDisplayConfigDto>(`/settings/display-config/${id}`, payload);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update display config'));
        }
    }
);

export const uploadDisplayMedia = createAsyncThunk(
    'displayConfig/uploadMedia',
    async ({id, file}: { id: number; file: File }, {rejectWithValue}) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            return await postFormData<ApiSuccessEnvelope<DisplayConfigEntity>>(`/settings/display-config/${id}/media`, formData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to upload display media'));
        }
    }
);

export const deleteDisplayConfig = createAsyncThunk(
    'displayConfig/delete',
    async (id: number, {rejectWithValue}) => {
        try {
            await del<ApiSuccessEnvelope<unknown>>(`/settings/display-config/${id}`);
            return {Id: id};
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete display config'));
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
        setDisplayConfigQuery: (state, action: { payload: DisplayConfigQuery }) => {
            state.query = {...state.query, ...action.payload};
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
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
                state.pagination = action.payload.meta ?? initialState.pagination;
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

export const {clearError, setDisplayConfigQuery} = displayConfigSlice.actions;
export default displayConfigSlice.reducer;
