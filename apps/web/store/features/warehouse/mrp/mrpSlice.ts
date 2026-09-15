/*By Irfan Akbari Vuteq Indonesia - 2026-06-18*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getApiErrorMessage, post, type ApiSuccessEnvelope } from '@/store/utils/apiService';

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

export const calculateMRP = createAsyncThunk<MRPResponse, void, { rejectValue: string }>(
    'mrp/calculate',
    async (_, { rejectWithValue }) => {
        try {
            const response = await post<ApiSuccessEnvelope<MRPResponse>>('/mrp/calculate', {});
            return response.data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Gagal menghitung MRP'));
        }
    },
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
