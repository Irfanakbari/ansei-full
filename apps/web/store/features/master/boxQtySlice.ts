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

export interface PartData {
    PartNumber: string;
    PartName: string;
}

export interface BoxQTYEntity {
    Id: number;
    PartNumber: string;
    Qty: number;
    PartData: PartData;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string | null;
    UpdatedAt: string;
    UpdatedBy: string | null;
    UpdatedByName?: string | null;
}

interface BoxQTYState {
    data: BoxQTYEntity[];
    loading: boolean;
    error: string | null;
    query: BoxQTYQuery;
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}

export interface BoxQTYQuery {
    page?: number;
    limit?: number;
    search?: string
}

const initialState: BoxQTYState = {
    data: [],
    loading: false,
    error: null,
    query: {page: 1, limit: 50},
    pagination: {page: 1, limit: 50, totalItems: 0, totalPages: 0},
};

export const fetchBoxQTY = createAsyncThunk<PaginatedApiSuccessEnvelope<BoxQTYEntity>, BoxQTYQuery | undefined, {
    rejectValue: string
}>(
    'boxQTY/fetchAll',
    async (query = {}, {rejectWithValue}) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<BoxQTYEntity>>('/master/box-qty', {
                params: {
                    page: query.page,
                    limit: query.limit,
                    search: query.search
                }
            });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch box QTY data'));
        }
    }
);

export const createBoxQTY = createAsyncThunk(
    'boxQTY/create',
    async (boxQTYData: {
        partNumber: string;
        qty: number;
    }, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<BoxQTYEntity>, typeof boxQTYData>('/master/box-qty', boxQTYData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create box QTY'));
        }
    }
);

export const updateBoxQTY = createAsyncThunk(
    'boxQTY/update',
    async ({id, data: updateData}: {
        id: number;
        data: {
            partNumber?: string;
            qty?: number;
        }
    }, {rejectWithValue}) => {
        try {
            return await patch<ApiSuccessEnvelope<BoxQTYEntity>, typeof updateData>(`/master/box-qty/${id}`, updateData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update box QTY'));
        }
    }
);

export const deleteBoxQTY = createAsyncThunk(
    'boxQTY/delete',
    async (id: number, {rejectWithValue}) => {
        try {
            await del<ApiSuccessEnvelope<unknown>>(`/master/box-qty/${id}`);
            return id;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete box QTY'));
        }
    }
);

const boxQTYSlice = createSlice({
    name: 'boxQTY',
    initialState,
    reducers: {
        setBoxQTYQuery: (state, action: { payload: BoxQTYQuery }) => {
            state.query = {...state.query, ...action.payload};
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchBoxQTY.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchBoxQTY.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
                state.pagination = action.payload.meta ?? initialState.pagination;
            })
            .addCase(fetchBoxQTY.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const {setBoxQTYQuery} = boxQTYSlice.actions;
export default boxQTYSlice.reducer;