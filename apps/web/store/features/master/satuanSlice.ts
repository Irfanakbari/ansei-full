/*By Irfan Akbari Vuteq Indonesia - 2026-06-07 - Updated 2026-06-16*/
import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {
    del,
    get,
    getApiErrorMessage,
    patch,
    post,
    type ApiSuccessEnvelope,
    type PaginatedApiSuccessEnvelope
} from '../../utils/apiService';

export interface SatuanEntity {
    Id: number;
    Name: string;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string | null;
    UpdatedAt: string;
    UpdatedBy: string | null;
    UpdatedByName?: string | null;
}

interface SatuanState {
    data: SatuanEntity[];
    loading: boolean;
    error: string | null;
    query: SatuanQuery;
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}

export interface SatuanQuery {
    page?: number;
    limit?: number;
    search?: string
}

const initialState: SatuanState = {
    data: [],
    loading: false,
    error: null,
    query: {page: 1, limit: 50},
    pagination: {page: 1, limit: 50, totalItems: 0, totalPages: 0},
};

export const fetchSatuan = createAsyncThunk<PaginatedApiSuccessEnvelope<SatuanEntity>, SatuanQuery | undefined, {
    rejectValue: string
}>(
    'satuan/fetchAll',
    async (query = {}, {rejectWithValue}) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<SatuanEntity>>('/master/satuan', {
                params: {
                    page: query.page,
                    limit: query.limit,
                    search: query.search
                }
            });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch satuan data'));
        }
    }
);

export const createSatuan = createAsyncThunk(
    'satuan/create',
    async (satuanData: { name: string }, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<SatuanEntity>, typeof satuanData>('/master/satuan', satuanData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create satuan'));
        }
    }
);

export const updateSatuan = createAsyncThunk(
    'satuan/update',
    async ({id, data: updateData}: { id: number; data: { name?: string } }, {rejectWithValue}) => {
        try {
            return await patch<ApiSuccessEnvelope<SatuanEntity>, typeof updateData>(`/master/satuan/${id}`, updateData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update satuan'));
        }
    }
);

export const deleteSatuan = createAsyncThunk(
    'satuan/delete',
    async (id: number, {rejectWithValue}) => {
        try {
            await del<ApiSuccessEnvelope<unknown>>(`/master/satuan/${id}`);
            return id;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete satuan'));
        }
    }
);

const satuanSlice = createSlice({
    name: 'satuan',
    initialState,
    reducers: {
        setSatuanQuery: (state, action: { payload: SatuanQuery }) => {
            state.query = {...state.query, ...action.payload};
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSatuan.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchSatuan.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
                state.pagination = action.payload.meta ?? initialState.pagination;
            })
            .addCase(fetchSatuan.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const {setSatuanQuery} = satuanSlice.actions;
export default satuanSlice.reducer;