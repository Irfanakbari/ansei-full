/*By Irfan Akbari Vuteq Indonesia - 2026-06-08 - Updated 2026-06-16*/
import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import { get, getApiErrorMessage, type PaginatedApiSuccessEnvelope } from '@/store/utils/apiService';

// Enums
export type ItemCategory = 'MATERIAL' | 'FINISH_GOOD';
export type LocationType = 'WAREHOUSE' | 'RACK' | 'FINISH_GOOD_AREA';
export type TransactionType =
    | 'INCOMING_SUPPLIER'
    | 'INCOMING_PRODUCTION'
    | 'OUTGOING_SHIPMENT'
    | 'OUTGOING_RETURN'
    | 'TRANSFER_TO_RACK'
    | 'TRANSFER_TO_FINISH_GOOD'
    | 'ADJUSTMENT_IN'
    | 'ADJUSTMENT_OUT'
    | 'SHOPPING_PICK'
    | 'LABEL_PRINTED'
    | 'LABEL_SCANNED';

// Query params interface
export interface StockTransactionLogQuery {
    page?: number;
    limit?: number;
    transactionDateFrom?: string;
    transactionDateTo?: string;
    itemCategory?: ItemCategory;
    transactionType?: TransactionType;
    materialId?: string;
    finishGoodId?: string;
    referenceDoc?: string;
    createdBy?: string;
    search?: string;
}

// Transaction log entity
export interface StockTransactionLogEntity {
    id: string;
    transactionDate: string;
    itemCategory: ItemCategory;
    materialId: string | null;
    finishGoodId: string | null;
    location: LocationType;
    transactionType: TransactionType;
    referenceDoc: string;
    balanceBefore: number;
    qtyIn: number;
    qtyOut: number;
    balanceAfter: number;
    createdBy: string;
    notes: string | null;
}

// Paginated response
export interface PaginatedStockTransactionLog {
    data: StockTransactionLogEntity[];
    meta: {
        totalItems: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

// Stock transaction log state
interface StockTransactionLogState {
    data: StockTransactionLogEntity[];
    loading: boolean;
    error: string | null;
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    filters: StockTransactionLogQuery;
}

// Transaction type options for dropdown
export const TRANSACTION_TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
    {value: 'INCOMING_SUPPLIER', label: 'Incoming Supplier'},
    {value: 'INCOMING_PRODUCTION', label: 'Incoming Production'},
    {value: 'OUTGOING_SHIPMENT', label: 'Outgoing Shipment'},
    {value: 'OUTGOING_RETURN', label: 'Outgoing Return'},
    {value: 'TRANSFER_TO_RACK', label: 'Transfer to Rack'},
    {value: 'TRANSFER_TO_FINISH_GOOD', label: 'Transfer to Finish Good'},
    {value: 'ADJUSTMENT_IN', label: 'Adjustment In'},
    {value: 'ADJUSTMENT_OUT', label: 'Adjustment Out'},
    {value: 'SHOPPING_PICK', label: 'Shopping Pick'},
    {value: 'LABEL_PRINTED', label: 'Label Printed'},
    {value: 'LABEL_SCANNED', label: 'Label Scanned'},
];

// Item category options
export const ITEM_CATEGORY_OPTIONS: { value: ItemCategory; label: string }[] = [
    {value: 'MATERIAL', label: 'Material'},
    {value: 'FINISH_GOOD', label: 'Finish Good'},
];

// Location type options
export const LOCATION_TYPE_OPTIONS: { value: LocationType; label: string }[] = [
    {value: 'WAREHOUSE', label: 'Warehouse'},
    {value: 'RACK', label: 'Rack'},
    {value: 'FINISH_GOOD_AREA', label: 'Finish Good Area'},
];

const initialState: StockTransactionLogState = {
    data: [],
    loading: false,
    error: null,
    pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
    },
    filters: {
        page: 1,
        limit: 50,
    },
};

// Fetch stock transaction logs
export const fetchStockTransactionLog = createAsyncThunk(
    'stockTransactionLog/fetchAll',
    async (filters: StockTransactionLogQuery, {rejectWithValue}) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<StockTransactionLogEntity>>('/system-log/inventory-ledger', { params: { ...filters } });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch stock transaction log'));
        }
    }
);

const stockTransactionLogSlice = createSlice({
    name: 'stockTransactionLog',
    initialState,
    reducers: {
        setFilters: (state, action) => {
            state.filters = {...state.filters, ...action.payload};
        },
        resetFilters: (state) => {
            state.filters = {
                page: 1,
                limit: 50,
            };
        },
        setPage: (state, action) => {
            state.filters.page = action.payload;
        },
        setLimit: (state, action) => {
            state.filters.limit = action.payload;
            state.filters.page = 1; // Reset to first page when changing limit
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchStockTransactionLog.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchStockTransactionLog.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload.data;
                state.pagination = {
                    page: action.payload.meta.page,
                    limit: action.payload.meta.limit,
                    total: action.payload.meta.totalItems,
                    totalPages: action.payload.meta.totalPages,
                };
            })
            .addCase(fetchStockTransactionLog.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const {setFilters, resetFilters, setPage, setLimit} = stockTransactionLogSlice.actions;
export default stockTransactionLogSlice.reducer;