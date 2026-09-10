/*By Irfan Akbari Vuteq Indonesia - 2026-06-07 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

export interface SupplierEntity {
    Id: number;
    Name: string;
    CreatedAt: string;
}

interface SupplierState {
    data: SupplierEntity[];
    loading: boolean;
    error: string | null;
}

const initialState: SupplierState = {
    data: [],
    loading: false,
    error: null,
};

export const fetchSupplier = createAsyncThunk(
    'supplier/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/master/supplier');
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch supplier data');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const createSupplier = createAsyncThunk(
    'supplier/create',
    async (supplierData: { name: string }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/master/supplier', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(supplierData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to create supplier');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const updateSupplier = createAsyncThunk(
    'supplier/update',
    async ({ id, data: updateData }: { id: number; data: { name?: string } }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/master/supplier/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to update supplier');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteSupplier = createAsyncThunk(
    'supplier/delete',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/master/supplier/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete supplier');
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const supplierSlice = createSlice({
    name: 'supplier',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchSupplier.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchSupplier.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
            })
            .addCase(fetchSupplier.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export default supplierSlice.reducer;