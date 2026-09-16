/*By Irfan Akbari Vuteq Indonesia - 2026-06-11 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { get, post, patch, del, getApiErrorMessage, type ApiSuccessEnvelope } from '@/store/utils/apiService';

// Entity interfaces
export interface TransferMaterialDetailEntity {
    Id: number;
    DeliveryNoteId: string;
    MaterialId: string;
    FinishGoodPartTemp: string | null;
    QtyRequested: number;
    QtyPicking: number;
    QtyReceived: number | null;
    MaterialData?: {
        PartNumber: string;
        PartName: string;
        QtyWarehouse: number;
        QtyRack: number;
    };
}

export interface TransferMaterialEntity {
    Id: string;
    DeliveryNoteNum: string;
    Destination: string;
    Status: 'DRAFT' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED';
    Notes: string | null;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string;
    ShippedAt: string | null;
    ShippedBy: string | null;
    ShippedByName?: string | null;
    ReceivedAt: string | null;
    ReceivedBy: string | null;
    ReceivedByName?: string | null;
    Details?: TransferMaterialDetailEntity[];
}

// Create DTO
export interface CreateTransferMaterialDto {
    destination: string;
    notes?: string;
    items: Array<{
        materialId: string;
        qtyRequested: number;
        FinishGoodPartTemp?: string;
    }>;
}

// Pick Material DTO
export interface PickMaterialDto {
    items: Array<{
        materialId: string;
        qtyPicking: number;
    }>;
}

// Query params
export interface TransferMaterialQuery {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
}

// Paginated response
export interface PaginatedTransferMaterial {
    data: TransferMaterialEntity[];
    meta: { totalItems: number; page: number; limit: number; totalPages: number };
}

// State interface
interface TransferMaterialState {
    data: TransferMaterialEntity[];
    currentItem: TransferMaterialEntity | null;
    loading: boolean;
    creating: boolean;
    error: string | null;
    pagination: {
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
    };
}

// Initial state
const initialState: TransferMaterialState = {
    data: [],
    currentItem: null,
    loading: false,
    creating: false,
    error: null,
    pagination: {
        page: 1,
        limit: 50,
        totalItems: 0,
        totalPages: 0,
    },
};

// Fetch all transfer material
export const fetchTransferMaterial = createAsyncThunk<ApiSuccessEnvelope<PaginatedTransferMaterial>, TransferMaterialQuery, { rejectValue: string }>(
    'transferMaterial/fetchAll',
    async (filters: TransferMaterialQuery, { rejectWithValue }) => {
        try {
            return await get<ApiSuccessEnvelope<PaginatedTransferMaterial>>('/transfer-material', {
                params: { page: filters.page, limit: filters.limit, search: filters.search, status: filters.status },
            });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch transfer material data'));
        }
    }
);

// Fetch single transfer material
export const fetchTransferMaterialById = createAsyncThunk(
    'transferMaterial/fetchById',
    async (id: string, { rejectWithValue }) => {
        try {
            const res = await get<ApiSuccessEnvelope<TransferMaterialEntity>>(`/transfer-material/${id}`);
            return res.data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch transfer material details'));
        }
    }
);

// Create transfer material
export const createTransferMaterial = createAsyncThunk(
    'transferMaterial/create',
    async (dto: CreateTransferMaterialDto, { rejectWithValue }) => {
        try {
            const res = await post<ApiSuccessEnvelope<TransferMaterialEntity>>('/transfer-material', dto);
            return res.data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create transfer material'));
        }
    }
);

// Update transfer material
export const updateTransferMaterial = createAsyncThunk(
    'transferMaterial/update',
    async ({ id, dto }: { id: string; dto: Partial<CreateTransferMaterialDto> }, { rejectWithValue }) => {
        try {
            const res = await patch<ApiSuccessEnvelope<TransferMaterialEntity>>(`/transfer-material/${id}`, dto);
            return res.data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update transfer material'));
        }
    }
);

// Delete transfer material
export const deleteTransferMaterial = createAsyncThunk(
    'transferMaterial/delete',
    async (id: string, { rejectWithValue }) => {
        try {
            const res = await del<ApiSuccessEnvelope<{ deleted: boolean; id: string }>>(`/transfer-material/${id}`);
            return res.data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete transfer material'));
        }
    }
);

// Pick material
export const pickTransferMaterial = createAsyncThunk(
    'transferMaterial/pick',
    async ({ id, dto }: { id: string; dto: PickMaterialDto }, { rejectWithValue }) => {
        try {
            const res = await patch<ApiSuccessEnvelope<TransferMaterialEntity>>(`/transfer-material/${id}/pick`, dto);
            return res.data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to pick material'));
        }
    }
);

// Ship transfer material
export const shipTransferMaterial = createAsyncThunk(
    'transferMaterial/ship',
    async (id: string, { rejectWithValue }) => {
        try {
            const res = await post<ApiSuccessEnvelope<TransferMaterialEntity>>(`/transfer-material/${id}/ship`, {});
            return res.data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to ship transfer material'));
        }
    }
);

// Receive transfer material
export const receiveTransferMaterial = createAsyncThunk(
    'transferMaterial/receive',
    async (id: string, { rejectWithValue }) => {
        try {
            const res = await post<ApiSuccessEnvelope<TransferMaterialEntity>>(`/transfer-material/${id}/receive`, {});
            return res.data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to receive transfer material'));
        }
    }
);

// Cancel transfer material
export const cancelTransferMaterial = createAsyncThunk(
    'transferMaterial/cancel',
    async (id: string, { rejectWithValue }) => {
        try {
            const res = await post<ApiSuccessEnvelope<TransferMaterialEntity>>(`/transfer-material/${id}/cancel`, {});
            return res.data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to cancel transfer material'));
        }
    }
);

// Download DN (Delivery Note)
export const downloadDN = createAsyncThunk(
    'transferMaterial/downloadDN',
    async (id: string) => {
        // Return just the URL - download handled client-side
        return { id };
    }
);

// Send DN via email
export interface SendDNDto {
    to: string;
    cc?: string;
    subject?: string;
    message?: string;
}

export const sendDN = createAsyncThunk(
    'transferMaterial/sendDN',
    async ({ id, dto }: { id: string; dto: SendDNDto }, { rejectWithValue }) => {
        try {
            const res = await post<ApiSuccessEnvelope<unknown>>(`/transfer-material/${id}/send-dn`, dto);
            return res.data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to send delivery note'));
        }
    }
);

// Slice
const transferMaterialSlice = createSlice({
    name: 'transferMaterial',
    initialState,
    reducers: {
        clearCurrentItem: (state) => {
            state.currentItem = null;
        },
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch all
            .addCase(fetchTransferMaterial.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchTransferMaterial.fulfilled, (state, action) => {
                state.loading = false;
                const raw = action.payload as any;
                if (Array.isArray(raw?.data)) {
                    state.data = raw.data;
                    state.pagination = {
                        page: raw.meta?.page || 1,
                        limit: raw.meta?.limit || 50,
                        totalItems: raw.meta?.totalItems || 0,
                        totalPages: raw.meta?.totalPages || 0,
                    };
                } else if (Array.isArray(raw?.data?.data)) {
                    state.data = raw.data.data;
                    state.pagination = {
                        page: raw.data.meta?.page || 1,
                        limit: raw.data.meta?.limit || 50,
                        totalItems: raw.data.meta?.totalItems || 0,
                        totalPages: raw.data.meta?.totalPages || 0,
                    };
                } else {
                    state.data = [];
                    state.pagination = initialState.pagination;
                }
            })
            .addCase(fetchTransferMaterial.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Fetch by ID
            .addCase(fetchTransferMaterialById.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchTransferMaterialById.fulfilled, (state, action) => {
                state.loading = false;
                state.currentItem = (action.payload as any)?.data || action.payload;
            })
            .addCase(fetchTransferMaterialById.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Create
            .addCase(createTransferMaterial.pending, (state) => {
                state.creating = true;
                state.error = null;
            })
            .addCase(createTransferMaterial.fulfilled, (state) => {
                state.creating = false;
            })
            .addCase(createTransferMaterial.rejected, (state, action) => {
                state.creating = false;
                state.error = action.payload as string;
            })
            // Update
            .addCase(updateTransferMaterial.fulfilled, (state, action) => {
                const item = (action.payload as any)?.data || action.payload;
                const index = state.data.findIndex(d => d.Id === item?.Id);
                if (index !== -1) {
                    state.data[index] = item;
                }
                if (state.currentItem?.Id === item?.Id) {
                    state.currentItem = item;
                }
            })
            // Delete
            .addCase(deleteTransferMaterial.fulfilled, (state, action) => {
                const payload = action.payload as any;
                const deletedId = payload?.id || payload?.data?.id || payload;
                state.data = state.data.filter(item => item.Id !== deletedId);
                if (state.currentItem?.Id === deletedId) {
                    state.currentItem = null;
                }
            })
            // Pick
            .addCase(pickTransferMaterial.fulfilled, (state, action) => {
                const item = (action.payload as any)?.data || action.payload;
                const index = state.data.findIndex(d => d.Id === item?.Id);
                if (index !== -1) {
                    state.data[index] = item;
                }
                if (state.currentItem?.Id === item?.Id) {
                    state.currentItem = item;
                }
            })
            // Ship
            .addCase(shipTransferMaterial.fulfilled, (state, action) => {
                const item = (action.payload as any)?.data || action.payload;
                const index = state.data.findIndex(d => d.Id === item?.Id);
                if (index !== -1) {
                    state.data[index] = item;
                }
                if (state.currentItem?.Id === item?.Id) {
                    state.currentItem = item;
                }
            })
            // Receive
            .addCase(receiveTransferMaterial.fulfilled, (state, action) => {
                const item = (action.payload as any)?.data || action.payload;
                const index = state.data.findIndex(d => d.Id === item?.Id);
                if (index !== -1) {
                    state.data[index] = item;
                }
                if (state.currentItem?.Id === item?.Id) {
                    state.currentItem = item;
                }
            })
            // Cancel
            .addCase(cancelTransferMaterial.fulfilled, (state, action) => {
                const item = (action.payload as any)?.data || action.payload;
                const index = state.data.findIndex(d => d.Id === item?.Id);
                if (index !== -1) {
                    state.data[index] = item;
                }
                if (state.currentItem?.Id === item?.Id) {
                    state.currentItem = item;
                }
            });
    },
});

export const { clearCurrentItem, clearError } = transferMaterialSlice.actions;
export default transferMaterialSlice.reducer;