/*By Irfan Akbari Vuteq Indonesia - 2026-06-07 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

export interface ManPowerEntity {
    Uid: string;
    Nik: string;
    Name: string;
    CreatedAt: string;
    Status: boolean;
    Line: string | null;
}

interface ManPowerState {
    data: ManPowerEntity[];
    loading: boolean;
    error: string | null;
}

const initialState: ManPowerState = {
    data: [],
    loading: false,
    error: null,
};

export const fetchManPower = createAsyncThunk(
    'manPower/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/master/man-power');
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch man power data');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const createManPower = createAsyncThunk(
    'manPower/create',
    async (manPowerData: {
        nik: string;
        name: string;
        line?: string;
        status?: boolean;
    }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/master/man-power', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(manPowerData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to create man power');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const updateManPower = createAsyncThunk(
    'manPower/update',
    async ({ uid, data: updateData }: {
        uid: string;
        data: {
            nik?: string;
            name?: string;
            line?: string;
            status?: boolean;
        }
    }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/master/man-power/${uid}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to update man power');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteManPower = createAsyncThunk(
    'manPower/delete',
    async (uid: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/master/man-power/${uid}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete man power');
            return uid;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const manPowerSlice = createSlice({
    name: 'manPower',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchManPower.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchManPower.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
            })
            .addCase(fetchManPower.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export default manPowerSlice.reducer;