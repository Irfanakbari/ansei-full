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

export interface SatuanData {
    Id: number;
    Name: string;
}

export interface MaterialEntity {
    Id: number;
    PartNumber: string;
    PartName: string;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string;
    UpdatedAt: string;
    UpdatedBy: string | null;
    UpdatedByName?: string | null;
    Supplier: string | null;
    SatuanId: number | null;
    RackLocation: string | null;
    QtyRack: number;
    QtyWarehouse: number;
    MinimumStock: number;
    MaximumStock: number;
    QtyPerBox: number;
    IsActive: boolean;
    DiscontinueDate: string | null;
    MaterialSource: 'LOKAL' | 'OVERSEAS' | null;
    Remark: string | null;
    SatuanData: SatuanData | null;
}

interface MaterialState {
    data: MaterialEntity[];
    loading: boolean;
    error: string | null;
    query: MaterialQuery;
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}

export interface MaterialQuery {
    page?: number;
    limit?: number;
    search?: string
}

const initialState: MaterialState = {
    data: [],
    loading: false,
    error: null,
    query: {page: 1, limit: 50},
    pagination: {page: 1, limit: 50, totalItems: 0, totalPages: 0},
};

export const fetchMaterial = createAsyncThunk<PaginatedApiSuccessEnvelope<MaterialEntity>, MaterialQuery | undefined, {
    rejectValue: string
}>(
    'material/fetchAll',
    async (query = {}, {rejectWithValue}) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<MaterialEntity>>('/master/material', {
                params: {
                    page: query.page,
                    limit: query.limit,
                    search: query.search
                }
            });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch material data'));
        }
    }
);

export const fetchMaterialByPartNumber = createAsyncThunk<ApiSuccessEnvelope<MaterialEntity>, string, {
    rejectValue: string
}>(
    'material/fetchByPartNumber',
    async (partNumber, {rejectWithValue}) => {
        try {
            return await get<ApiSuccessEnvelope<MaterialEntity>>(`/master/material/part-number/${encodeURIComponent(partNumber)}`);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch material detail'));
        }
    }
);

export const createMaterial = createAsyncThunk(
    'material/create',
    async (materialData: {
        partNumber: string;
        partName: string;
        supplier?: string;
        satuanId?: number;
        rackLocation?: string;
        minimumStock?: number;
        maximumStock?: number;
        qtyPerBox?: number;
        materialSource?: 'LOKAL' | 'OVERSEAS';
        remark?: string;
    }, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<MaterialEntity>, typeof materialData>('/master/material', materialData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create material'));
        }
    }
);

export const updateMaterial = createAsyncThunk(
    'material/update',
    async ({id, data: updateData}: {
        id: number;
        data: {
            partNumber?: string;
            partName?: string;
            supplier?: string;
            satuanId?: number;
            rackLocation?: string;
            minimumStock?: number;
            maximumStock?: number;
            qtyPerBox?: number;
            materialSource?: 'LOKAL' | 'OVERSEAS';
            remark?: string;
        }
    }, {rejectWithValue}) => {
        try {
            return await patch<ApiSuccessEnvelope<MaterialEntity>, typeof updateData>(`/master/material/${id}`, updateData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update material'));
        }
    }
);

export const deleteMaterial = createAsyncThunk(
    'material/delete',
    async (id: number, {rejectWithValue}) => {
        try {
            await del<ApiSuccessEnvelope<unknown>>(`/master/material/${id}`);
            return id;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete material'));
        }
    }
);

export const discontinueMaterial = createAsyncThunk(
    'material/discontinue',
    async ({partNumber, reason}: { partNumber: string; reason: string }, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<MaterialEntity>, {
                reason: string
            }>(`/master/material/part-number/${encodeURIComponent(partNumber)}/discontinue`, {reason});
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to discontinue material'));
        }
    }
);

export const reactivateMaterial = createAsyncThunk(
    'material/reactivate',
    async (partNumber: string, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<MaterialEntity>>(`/master/material/part-number/${encodeURIComponent(partNumber)}/reactivate`, {});
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to reactivate material'));
        }
    }
);

export const transferMaterialStock = createAsyncThunk(
    'material/transferStock',
    async (transferData: {
        sourcePartNumber: string;
        targetPartNumber: string;
        location: 'WAREHOUSE' | 'RACK';
        qty: number;
        reason: string;
    }, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<{
                sourcePartNumber: string;
                targetPartNumber: string;
                location: string;
                qty: number;
                sourceBalanceBefore: number;
                sourceBalanceAfter: number;
                targetBalanceBefore: number;
                targetBalanceAfter: number;
                reason: string;
            }>, typeof transferData>('/master/material/transfer-stock', transferData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to transfer material stock'));
        }
    }
);

const materialSlice = createSlice({
    name: 'material',
    initialState,
    reducers: {
        setMaterialQuery: (state, action: { payload: MaterialQuery }) => {
            state.query = {...state.query, ...action.payload};
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchMaterial.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchMaterial.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
                state.pagination = action.payload.meta ?? initialState.pagination;
            })
            .addCase(fetchMaterial.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const {setMaterialQuery} = materialSlice.actions;
export default materialSlice.reducer;