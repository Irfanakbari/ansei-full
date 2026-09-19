/*By Irfan Akbari Vuteq Indonesia - 2026-06-08 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { post, getApiErrorMessage, type ApiSuccessEnvelope } from '@/store/utils/apiService';
import { commandIdentity } from '@/store/utils/commandIdentity';

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
            const path = `/warehouse/material/${encodeURIComponent(partNumber)}/transfer-to-rack`;
            const command = await commandIdentity('POST', path, { qty });
            const response = await post<ApiSuccessEnvelope<TransferToRackResponse>>(path, { qty, requestId: command.id });
            command.complete();
            return response.data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to transfer to rack'));
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
