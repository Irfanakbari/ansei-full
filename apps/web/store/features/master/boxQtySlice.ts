/*By Irfan Akbari Vuteq Indonesia - 2026-06-07 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

export interface PartData {
    PartNumber: string;
    PartName: string;
}

export interface BoxQTYEntity {
    Id: number;
    PartNumber: string;
    Qty: number;
    PartData: PartData;
}

interface BoxQTYState {
    data: BoxQTYEntity[];
    loading: boolean;
    error: string | null;
}

const initialState: BoxQTYState = {
    data: [],
    loading: false,
    error: null,
};

export const fetchBoxQTY = createAsyncThunk(
    'boxQTY/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/master/box-qty');
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch box QTY data');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const createBoxQTY = createAsyncThunk(
    'boxQTY/create',
    async (boxQTYData: {
        partNumber: string;
        qty: number;
    }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/master/box-qty', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(boxQTYData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to create box QTY');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const updateBoxQTY = createAsyncThunk(
    'boxQTY/update',
    async ({ id, data: updateData }: {
        id: number;
        data: {
            partNumber?: string;
            qty?: number;
        }
    }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/master/box-qty/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to update box QTY');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteBoxQTY = createAsyncThunk(
    'boxQTY/delete',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/master/box-qty/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete box QTY');
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const boxQTYSlice = createSlice({
    name: 'boxQTY',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchBoxQTY.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchBoxQTY.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
            })
            .addCase(fetchBoxQTY.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export default boxQTYSlice.reducer;