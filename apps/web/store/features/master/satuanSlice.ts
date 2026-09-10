/*By Irfan Akbari Vuteq Indonesia - 2026-06-07 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

export interface SatuanEntity {
    Id: number;
    Name: string;
}

interface SatuanState {
    data: SatuanEntity[];
    loading: boolean;
    error: string | null;
}

const initialState: SatuanState = {
    data: [],
    loading: false,
    error: null,
};

export const fetchSatuan = createAsyncThunk(
    'satuan/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            // Token is now automatically read from httpOnly cookie by fetchWithAuth
            const response = await fetchWithAuth('/api/master/satuan');
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch satuan data');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const createSatuan = createAsyncThunk(
    'satuan/create',
    async (satuanData: { name: string }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/master/satuan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(satuanData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to create satuan');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const updateSatuan = createAsyncThunk(
    'satuan/update',
    async ({ id, data: updateData }: { id: number; data: { name?: string } }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/master/satuan/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to update satuan');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteSatuan = createAsyncThunk(
    'satuan/delete',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/master/satuan/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete satuan');
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const satuanSlice = createSlice({
    name: 'satuan',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchSatuan.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchSatuan.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
            })
            .addCase(fetchSatuan.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export default satuanSlice.reducer;