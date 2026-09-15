/*By Irfan Akbari Vuteq Indonesia - 2026-06-07 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { del, get, getApiErrorMessage, patch, post, type ApiSuccessEnvelope, type PaginatedApiSuccessEnvelope } from '../../utils/apiService';

export interface FinishGoodEntity {
    Id: number;
    PartNumber: string;
    PartName: string;
    Price: number | null;
    CreatedAt: string;
    CreatedBy: string;
    UpdatedAt: string;
    Qty: number;
}

interface FinishGoodState {
    data: FinishGoodEntity[];
    loading: boolean;
    error: string | null;
    query: FinishGoodQuery;
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}
export interface FinishGoodQuery { page?: number; limit?: number; search?: string }

const initialState: FinishGoodState = {
    data: [],
    loading: false,
    error: null,
    query: { page: 1, limit: 50 },
    pagination: { page: 1, limit: 50, totalItems: 0, totalPages: 0 },
};

export const fetchFinishGood = createAsyncThunk<PaginatedApiSuccessEnvelope<FinishGoodEntity>, FinishGoodQuery | undefined, { rejectValue: string }>(
    'finishGood/fetchAll',
    async (query = {}, { rejectWithValue }) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<FinishGoodEntity>>('/master/finish-good', { params: { page: query.page, limit: query.limit, search: query.search } });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch finish good data'));
        }
    }
);

export const createFinishGood = createAsyncThunk(
    'finishGood/create',
    async (finishGoodData: {
        partNumber: string;
        partName: string;
        price?: number;
        qty?: number;
    }, { rejectWithValue }) => {
        try {
            return await post<ApiSuccessEnvelope<FinishGoodEntity>, typeof finishGoodData>('/master/finish-good', finishGoodData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create finish good'));
        }
    }
);

export const updateFinishGood = createAsyncThunk(
    'finishGood/update',
    async ({ id, data: updateData }: {
        id: number;
        data: {
            partNumber?: string;
            partName?: string;
            price?: number;
            qty?: number;
        }
    }, { rejectWithValue }) => {
        try {
            return await patch<ApiSuccessEnvelope<FinishGoodEntity>, typeof updateData>(`/master/finish-good/${id}`, updateData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update finish good'));
        }
    }
);

export const deleteFinishGood = createAsyncThunk(
    'finishGood/delete',
    async (id: number, { rejectWithValue }) => {
        try {
            await del<ApiSuccessEnvelope<unknown>>(`/master/finish-good/${id}`);
            return id;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete finish good'));
        }
    }
);

const finishGoodSlice = createSlice({
    name: 'finishGood',
    initialState,
    reducers: { setFinishGoodQuery: (state, action: { payload: FinishGoodQuery }) => { state.query = { ...state.query, ...action.payload }; } },
    extraReducers: (builder) => {
        builder
            .addCase(fetchFinishGood.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchFinishGood.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload.data;
                state.pagination = action.payload.meta;
            })
            .addCase(fetchFinishGood.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { setFinishGoodQuery } = finishGoodSlice.actions;
export default finishGoodSlice.reducer;