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

export interface SupplierEntity {
    Id: number;
    Name: string;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string | null;
    UpdatedAt: string;
    UpdatedBy: string | null;
    UpdatedByName?: string | null;
}

interface SupplierState {
    data: SupplierEntity[];
    loading: boolean;
    error: string | null;
    query: SupplierQuery;
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}

export interface SupplierQuery {
    page?: number;
    limit?: number;
    search?: string
}

const initialState: SupplierState = {
    data: [],
    loading: false,
    error: null,
    query: {page: 1, limit: 50},
    pagination: {page: 1, limit: 50, totalItems: 0, totalPages: 0},
};

export const fetchSupplier = createAsyncThunk<PaginatedApiSuccessEnvelope<SupplierEntity>, SupplierQuery | undefined, {
    rejectValue: string
}>(
    'supplier/fetchAll',
    async (query = {}, {rejectWithValue}) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<SupplierEntity>>('/master/supplier', {
                params: {
                    page: query.page,
                    limit: query.limit,
                    search: query.search
                }
            });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch supplier data'));
        }
    }
);

export const createSupplier = createAsyncThunk(
    'supplier/create',
    async (supplierData: { name: string }, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<SupplierEntity>, typeof supplierData>('/master/supplier', supplierData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create supplier'));
        }
    }
);

export const updateSupplier = createAsyncThunk(
    'supplier/update',
    async ({id, data: updateData}: { id: number; data: { name?: string } }, {rejectWithValue}) => {
        try {
            return await patch<ApiSuccessEnvelope<SupplierEntity>, typeof updateData>(`/master/supplier/${id}`, updateData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update supplier'));
        }
    }
);

export const deleteSupplier = createAsyncThunk(
    'supplier/delete',
    async (id: number, {rejectWithValue}) => {
        try {
            await del<ApiSuccessEnvelope<unknown>>(`/master/supplier/${id}`);
            return id;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete supplier'));
        }
    }
);

const supplierSlice = createSlice({
    name: 'supplier',
    initialState,
    reducers: {
        setSupplierQuery: (state, action: { payload: SupplierQuery }) => {
            state.query = {...state.query, ...action.payload};
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSupplier.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchSupplier.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
                state.pagination = action.payload.meta ?? initialState.pagination;
            })
            .addCase(fetchSupplier.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const {setSupplierQuery} = supplierSlice.actions;
export default supplierSlice.reducer;