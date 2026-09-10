/*By Irfan Akbari Vuteq Indonesia - 2026-06-08 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {fetchWithAuth} from "@/store/utils/fetchWithAuth";

// Transfer response interface
export interface TransferToRackResponse {
    success: boolean;
    partNumber: string;
    warehouseBefore: number;
    warehouseAfter: number;
    rackBefore: number;
    rackAfter: number;
    transferQty: number;
}

// Transfer state
interface TransferState {
    result: TransferToRackResponse | null;
    loading: boolean;
    error: string | null;
}

const initialState: TransferState = {
    result: null,
    loading: false,
    error: null,
};

// Transfer to rack
export const transferToRack = createAsyncThunk(
    'transfer/toRack',
    async ({ partNumber, qty }: { partNumber: string; qty: number }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/material/${partNumber}/transfer-to-rack`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qty }),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to transfer to rack');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const transferSlice = createSlice({
    name: 'transfer',
    initialState,
    reducers: {
        clearTransferResult: (state) => {
            state.result = null;
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(transferToRack.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(transferToRack.fulfilled, (state, action) => {
                state.loading = false;
                state.result = action.payload;
            })
            .addCase(transferToRack.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearTransferResult } = transferSlice.actions;
export default transferSlice.reducer;