/*By Irfan Akbari Vuteq Indonesia - 2026-06-07 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

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
}

const initialState: FinishGoodState = {
    data: [],
    loading: false,
    error: null,
};

export const fetchFinishGood = createAsyncThunk(
    'finishGood/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/master/finish-good');
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch finish good data');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
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
            const response = await fetchWithAuth('/api/master/finish-good', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finishGoodData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to create finish good');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
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
            const response = await fetchWithAuth(`/api/master/finish-good/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to update finish good');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteFinishGood = createAsyncThunk(
    'finishGood/delete',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/master/finish-good/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete finish good');
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const finishGoodSlice = createSlice({
    name: 'finishGood',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchFinishGood.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchFinishGood.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
            })
            .addCase(fetchFinishGood.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export default finishGoodSlice.reducer;