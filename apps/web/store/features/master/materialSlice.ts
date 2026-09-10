/*By Irfan Akbari Vuteq Indonesia - 2026-06-07 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

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
    UpdatedAt: string;
    Supplier: string | null;
    SatuanId: number | null;
    RackLocation: string | null;
    QtyRack: number;
    QtyWarehouse: number;
    SatuanData: SatuanData | null;
}

interface MaterialState {
    data: MaterialEntity[];
    loading: boolean;
    error: string | null;
}

const initialState: MaterialState = {
    data: [],
    loading: false,
    error: null,
};

export const fetchMaterial = createAsyncThunk(
    'material/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/master/material');
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch material data');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
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
        qtyRack?: number;
        qtyWarehouse?: number;
    }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/master/material', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(materialData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to create material');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const updateMaterial = createAsyncThunk(
    'material/update',
    async ({ id, data: updateData }: {
        id: number;
        data: {
            partNumber?: string;
            partName?: string;
            supplier?: string;
            satuanId?: number;
            rackLocation?: string;
            qtyRack?: number;
            qtyWarehouse?: number;
        }
    }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/master/material/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to update material');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteMaterial = createAsyncThunk(
    'material/delete',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/master/material/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete material');
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const discontinueMaterial = createAsyncThunk(
    'material/discontinue',
    async ({ partNumber, reason }: { partNumber: string; reason: string }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/master/material/part-number/${partNumber}/discontinue`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to discontinue material');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const materialSlice = createSlice({
    name: 'material',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchMaterial.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchMaterial.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
            })
            .addCase(fetchMaterial.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export default materialSlice.reducer;