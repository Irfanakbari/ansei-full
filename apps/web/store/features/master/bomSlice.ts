/*By Irfan Akbari Vuteq Indonesia - 2026-06-07 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

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
}

const initialState: BOMState = {
    data: [],
    loading: false,
    error: null,
};

export const fetchBOM = createAsyncThunk(
    'bom/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/master/bill-of-materials');
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch BOM data');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
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
            const response = await fetchWithAuth('/api/master/bill-of-materials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bomData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to create BOM');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
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
            const response = await fetchWithAuth(`/api/master/bill-of-materials/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to update BOM');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteBOM = createAsyncThunk(
    'bom/delete',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/master/bill-of-materials/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete BOM');
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const bomSlice = createSlice({
    name: 'bom',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchBOM.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchBOM.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
            })
            .addCase(fetchBOM.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export default bomSlice.reducer;