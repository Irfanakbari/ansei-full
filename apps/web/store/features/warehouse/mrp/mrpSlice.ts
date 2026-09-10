/*By Irfan Akbari Vuteq Indonesia - 2026-06-18*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '@/store/utils/fetchWithAuth';

interface DailyDemand {
    date: string;
    demand: number;
    lack: number;
}

interface MaterialMRP {
    materialId: number;
    partNumber: string;
    partName: string;
    supplier: string;
    rackLocation: string;
    qtyRack: number;
    qtyWarehouse: number;
    qtyPending: number;
    qtyCurrentTotal: number;
    dailyDemand: DailyDemand[];
}

interface DateRange {
    today: string;
    startDate: string;
    endDate: string;
}

interface MRPResponse {
    calculatedAt: string;
    dateRange: DateRange;
    materials: MaterialMRP[];
}

interface MRPState {
    data: MRPResponse | null;
    loading: boolean;
    error: string | null;
}

const initialState: MRPState = {
    data: null,
    loading: false,
    error: null,
};

export const calculateMRP = createAsyncThunk(
    'mrp/calculate',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/warehouse/mrp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            const data = await response.json();
            if (!response.ok) {
                return rejectWithValue(data.message || 'Gagal menghitung MRP');
            }
            return data as MRPResponse;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Terjadi kesalahan');
        }
    }
);

const mrpSlice = createSlice({
    name: 'mrp',
    initialState,
    reducers: {
        clearMRP: (state) => {
            state.data = null;
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(calculateMRP.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(calculateMRP.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload;
                state.error = null;
            })
            .addCase(calculateMRP.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearMRP } = mrpSlice.actions;
export default mrpSlice.reducer;
