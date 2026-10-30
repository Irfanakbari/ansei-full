/* By Irfan Akbari Vuteq Indonesia - 2026-06-08 - Updated 2026-10-29 */
import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { get, post, getApiErrorMessage, type ApiSuccessEnvelope } from '@/store/utils/apiService';
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

export interface TransferHistoryItem {
  id: string;
  referenceDoc: string;
  materialId: string;
  partName: string;
  rackLocation: string | null;
  qty: number;
  warehouseBefore: number;
  warehouseAfter: number;
  rackBefore: number;
  rackAfter: number;
  transactionDate: string;
  createdBy: string;
  createdByName?: string;
  status: 'COMPLETED' | 'REVERTED';
  revertedAt?: string | null;
  revertedBy?: string | null;
  revertedByName?: string | null;
  notes?: string | null;
}

export interface TransferHistoryQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface RevertTransferResult {
  success: boolean;
  referenceDoc: string;
  partNumber: string;
  transferQty: number;
  warehouseBefore: number;
  warehouseAfter: number;
  rackBefore: number;
  rackAfter: number;
  revertedAt: string;
  revertedBy: string;
  revertedByName?: string;
}

// Transfer state
interface TransferState {
  history: TransferHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  query: TransferHistoryQuery;
  result: TransferToRackResponse | null;
  loading: boolean;
  transferLoading: boolean;
  revertLoading: boolean;
  error: string | null;
}

const initialState: TransferState = {
  history: [],
  pagination: {
    page: 1,
    limit: 50,
    totalItems: 0,
    totalPages: 0,
  },
  query: {
    page: 1,
    limit: 50,
  },
  result: null,
  loading: false,
  transferLoading: false,
  revertLoading: false,
  error: null,
};

// Fetch transfer history
export const fetchTransferHistory = createAsyncThunk(
  'transfer/fetchHistory',
  async (params: TransferHistoryQuery = {}, { rejectWithValue }) => {
    try {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      if (params.search) searchParams.set('search', params.search);
      if (params.status && params.status !== 'ALL') {
        searchParams.set('status', params.status);
      }

      const qs = searchParams.toString();
      const path = `/warehouse/material/transfer-history${qs ? `?${qs}` : ''}`;
      const response = await get<ApiSuccessEnvelope<TransferHistoryItem[]>>(path);
      const meta = response.meta as
        | {
            page: number;
            limit: number;
            totalItems: number;
            totalPages: number;
          }
        | undefined;
      return {
        data: response.data || [],
        meta: meta || {
          page: params.page ?? 1,
          limit: params.limit ?? 50,
          totalItems: response.data?.length ?? 0,
          totalPages: 1,
        },
      };
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, 'Failed to fetch transfer history'),
      );
    }
  },
);

// Transfer to rack (new / generalized)
export const transferToRack = createAsyncThunk(
  'transfer/toRack',
  async (
    {
      partNumber,
      qty,
      notes,
    }: { partNumber: string; qty: number; notes?: string },
    { rejectWithValue },
  ) => {
    try {
      const path = '/warehouse/material/transfer-to-rack';
      const command = await commandIdentity('POST', path, {
        partNumber,
        qty,
        notes: notes?.trim() || undefined,
      });
      const response = await post<ApiSuccessEnvelope<TransferToRackResponse>>(
        path,
        {
          partNumber,
          qty,
          notes,
          requestId: command.id,
        },
      );
      command.complete();
      return response.data;
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, 'Failed to transfer to rack'),
      );
    }
  },
);

// Revert transfer
export const revertTransfer = createAsyncThunk(
  'transfer/revert',
  async (
    { referenceDoc, reason }: { referenceDoc: string; reason?: string },
    { rejectWithValue },
  ) => {
    try {
      const path = `/warehouse/material/transfer/${encodeURIComponent(referenceDoc)}/revert`;
      const normalizedReason = reason?.trim() || '';
      const command = await commandIdentity('POST', path, {
        referenceDoc,
        reason: normalizedReason,
      });
      const response = await post<ApiSuccessEnvelope<RevertTransferResult>>(
        path,
        { reason: normalizedReason, requestId: command.id },
      );
      command.complete();
      return response.data;
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, 'Failed to revert transfer'),
      );
    }
  },
);

const transferSlice = createSlice({
  name: 'transfer',
  initialState,
  reducers: {
    setTransferQuery: (state, action: PayloadAction<TransferHistoryQuery>) => {
      state.query = { ...state.query, ...action.payload };
    },
    clearTransferResult: (state) => {
      state.result = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch History
      .addCase(fetchTransferHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransferHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.history = action.payload.data;
        state.pagination = action.payload.meta;
      })
      .addCase(fetchTransferHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Transfer to Rack
      .addCase(transferToRack.pending, (state) => {
        state.transferLoading = true;
        state.error = null;
      })
      .addCase(transferToRack.fulfilled, (state, action) => {
        state.transferLoading = false;
        state.result = action.payload;
      })
      .addCase(transferToRack.rejected, (state, action) => {
        state.transferLoading = false;
        state.error = action.payload as string;
      })
      // Revert Transfer
      .addCase(revertTransfer.pending, (state) => {
        state.revertLoading = true;
        state.error = null;
      })
      .addCase(revertTransfer.fulfilled, (state) => {
        state.revertLoading = false;
      })
      .addCase(revertTransfer.rejected, (state, action) => {
        state.revertLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setTransferQuery, clearTransferResult } = transferSlice.actions;
export default transferSlice.reducer;
