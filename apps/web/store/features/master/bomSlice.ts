/*By Irfan Akbari Vuteq Indonesia - 2026-06-07 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { del, get, getApiErrorMessage, patch, post, type ApiSuccessEnvelope, type PaginatedApiSuccessEnvelope } from '../../utils/apiService';

export interface FGData {
    Id: number;
    PartNumber: string;
    PartName: string;
}

export interface MaterialData {
    Id: number;
    PartNumber: string;
    PartName: string;
}

export interface BOMEntity {
    Id: number;
    MaterialId: number;
    FinishGoodId: string;
    Qty: number;
    FGData: FGData;
    MaterialData: MaterialData;
}

export interface BOMGrouped {
    FinishGoodId: string;
    FGData: FGData;
    materials: BOMEntity[];
}

interface BOMState {
    data: BOMEntity[];
    loading: boolean;
    error: string | null;
    query: BOMQuery;
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}
export interface BOMQuery { page?: number; limit?: number; search?: string }

const initialState: BOMState = {
    data: [],
    loading: false,
    error: null,
    query: { page: 1, limit: 50 },
    pagination: { page: 1, limit: 50, totalItems: 0, totalPages: 0 },
};

export const fetchBOM = createAsyncThunk<PaginatedApiSuccessEnvelope<BOMEntity>, BOMQuery | undefined, { rejectValue: string }>(
    'bom/fetchAll',
    async (query = {}, { rejectWithValue }) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<BOMEntity>>('/master/bill-of-materials', { params: { page: query.page, limit: query.limit, search: query.search } });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch BOM data'));
        }
    }
);

export const createBOM = createAsyncThunk(
    'bom/create',
    async (bomData: {
        materialId: string;
        finishGoodId: string;
        qty: string;
    }, { rejectWithValue }) => {
        try {
            return await post<ApiSuccessEnvelope<BOMEntity>, typeof bomData>('/master/bill-of-materials', bomData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create BOM'));
        }
    }
);

export const updateBOM = createAsyncThunk(
    'bom/update',
    async ({ id, data: updateData }: {
        id: number;
        data: {
            materialId?: string;
            finishGoodId?: string;
            qty?: string;
        }
    }, { rejectWithValue }) => {
        try {
            return await patch<ApiSuccessEnvelope<BOMEntity>, typeof updateData>(`/master/bill-of-materials/${id}`, updateData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update BOM'));
        }
    }
);

export const deleteBOM = createAsyncThunk(
    'bom/delete',
    async (id: number, { rejectWithValue }) => {
        try {
            await del<ApiSuccessEnvelope<unknown>>(`/master/bill-of-materials/${id}`);
            return id;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete BOM'));
        }
    }
);

const bomSlice = createSlice({
    name: 'bom',
    initialState,
    reducers: { setBOMQuery: (state, action: { payload: BOMQuery }) => { state.query = { ...state.query, ...action.payload }; } },
    extraReducers: (builder) => {
        builder
            .addCase(fetchBOM.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchBOM.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
                state.pagination = action.payload.meta ?? initialState.pagination;
            })
            .addCase(fetchBOM.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { setBOMQuery } = bomSlice.actions;
export default bomSlice.reducer;