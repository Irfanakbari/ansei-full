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

export interface FinishGoodEntity {
    Id: number;
    PartNumber: string;
    PartName: string;
    Alias: string | null;
    IsPassthrough: boolean;
    Price: number | null;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string;
    UpdatedAt: string;
    UpdatedBy: string | null;
    UpdatedByName?: string | null;
    Qty: number;
    IsActive: boolean;
    DiscontinueDate: string | null;
}

interface FinishGoodState {
    data: FinishGoodEntity[];
    loading: boolean;
    error: string | null;
    query: FinishGoodQuery;
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}

export interface FinishGoodQuery {
    page?: number;
    limit?: number;
    search?: string
}

const initialState: FinishGoodState = {
    data: [],
    loading: false,
    error: null,
    query: {page: 1, limit: 50},
    pagination: {page: 1, limit: 50, totalItems: 0, totalPages: 0},
};

export const exportFinishGoodExcel = createAsyncThunk(
    'finishGood/exportExcel',
    async (query: { search?: string } | undefined, {rejectWithValue}) => {
        try {
            const { downloadWithAutoFilename } = await import('../../utils/apiService');
            await downloadWithAutoFilename('/master/finish-good/export', {
                params: {
                    search: query?.search
                }
            });
            return true;
        } catch (error: unknown) {
            const { getApiErrorMessage } = await import('../../utils/apiService');
            return rejectWithValue(getApiErrorMessage(error, 'Failed to export finish goods'));
        }
    }
);

export const fetchFinishGood = createAsyncThunk<PaginatedApiSuccessEnvelope<FinishGoodEntity>, FinishGoodQuery | undefined, {
    rejectValue: string
}>(
    'finishGood/fetchAll',
    async (query = {}, {rejectWithValue}) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<FinishGoodEntity>>('/master/finish-good', {
                params: {
                    page: query.page,
                    limit: query.limit,
                    search: query.search
                }
            });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch finish good data'));
        }
    }
);

export const fetchFinishGoodByPartNumber = createAsyncThunk<ApiSuccessEnvelope<FinishGoodEntity>, string, {
    rejectValue: string
}>(
    'finishGood/fetchByPartNumber',
    async (partNumber, {rejectWithValue}) => {
        try {
            return await get<ApiSuccessEnvelope<FinishGoodEntity>>(`/master/finish-good/part-number/${encodeURIComponent(partNumber)}`);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch finish good detail'));
        }
    }
);

export const createFinishGood = createAsyncThunk(
    'finishGood/create',
    async (finishGoodData: {
        partNumber: string;
        partName: string;
        alias?: string;
        price?: number;
        isPassthrough?: boolean;
        qty?: number;
    }, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<FinishGoodEntity>, typeof finishGoodData>('/master/finish-good', finishGoodData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create finish good'));
        }
    }
);

export const updateFinishGood = createAsyncThunk(
    'finishGood/update',
    async ({id, data: updateData}: {
        id: number;
        data: {
            partNumber?: string;
            partName?: string;
            alias?: string;
            price?: number;
            isPassthrough?: boolean;
        }
    }, {rejectWithValue}) => {
        try {
            return await patch<ApiSuccessEnvelope<FinishGoodEntity>, typeof updateData>(`/master/finish-good/${id}`, updateData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update finish good'));
        }
    }
);

export const deleteFinishGood = createAsyncThunk(
    'finishGood/delete',
    async (id: number, {rejectWithValue}) => {
        try {
            await del<ApiSuccessEnvelope<unknown>>(`/master/finish-good/${id}`);
            return id;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete finish good'));
        }
    }
);

export const discontinueFinishGood = createAsyncThunk(
    'finishGood/discontinue',
    async ({id, reason}: { id: number; reason: string }, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<FinishGoodEntity>, {
                reason: string
            }>(`/master/finish-good/${id}/discontinue`, {reason});
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to discontinue finish good'));
        }
    }
);

export const reactivateFinishGood = createAsyncThunk(
    'finishGood/reactivate',
    async (id: number, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<FinishGoodEntity>>(`/master/finish-good/${id}/reactivate`, {});
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to reactivate finish good'));
        }
    }
);

export const transferFinishGoodStock = createAsyncThunk(
    'finishGood/transferStock',
    async (transferData: {
        id: number;
        targetPartNumber: string;
        qty: number;
        reason: string;
    }, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<{
                sourcePartNumber: string;
                targetPartNumber: string;
                qty: number;
                sourceBalanceBefore: number;
                sourceBalanceAfter: number;
                targetBalanceBefore: number;
                targetBalanceAfter: number;
                reason: string;
            }>, { targetPartNumber: string; qty: number; reason: string }>(`/master/finish-good/${transferData.id}/transfer-stock`, {
                targetPartNumber: transferData.targetPartNumber,
                qty: transferData.qty,
                reason: transferData.reason,
            });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to transfer finish good stock'));
        }
    }
);

const finishGoodSlice = createSlice({
    name: 'finishGood',
    initialState,
    reducers: {
        setFinishGoodQuery: (state, action: { payload: FinishGoodQuery }) => {
            state.query = {...state.query, ...action.payload};
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchFinishGood.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchFinishGood.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
                state.pagination = action.payload.meta ?? initialState.pagination;
            })
            .addCase(fetchFinishGood.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const {setFinishGoodQuery} = finishGoodSlice.actions;
export default finishGoodSlice.reducer;