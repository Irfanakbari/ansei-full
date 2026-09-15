/*By Irfan Akbari Vuteq Indonesia - 2026-06-11 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '@/store/utils/fetchWithAuth';
import { get, getApiErrorMessage, type ApiSuccessEnvelope } from '@/store/utils/apiService';

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
            const response = await fetchWithAuth(`/api/warehouse/transfer-material/${id}`);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch transfer material detail');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Create transfer material
export const createTransferMaterial = createAsyncThunk(
    'transferMaterial/create',
    async (dto: CreateTransferMaterialDto, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/warehouse/transfer-material', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dto),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to create transfer material');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Update transfer material
export const updateTransferMaterial = createAsyncThunk(
    'transferMaterial/update',
    async ({ id, dto }: { id: string; dto: Partial<CreateTransferMaterialDto> }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/transfer-material/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dto),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to update transfer material');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Delete transfer material
export const deleteTransferMaterial = createAsyncThunk(
    'transferMaterial/delete',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/transfer-material/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete transfer material');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Pick material
export const pickTransferMaterial = createAsyncThunk(
    'transferMaterial/pick',
    async ({ id, dto }: { id: string; dto: PickMaterialDto }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/transfer-material/${id}/pick`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dto),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to pick material');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Ship transfer material
export const shipTransferMaterial = createAsyncThunk(
    'transferMaterial/ship',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/transfer-material/${id}/ship`, {
                method: 'POST',
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to ship transfer material');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Receive transfer material
export const receiveTransferMaterial = createAsyncThunk(
    'transferMaterial/receive',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/transfer-material/${id}/receive`, {
                method: 'POST',
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to receive transfer material');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Cancel transfer material
export const cancelTransferMaterial = createAsyncThunk(
    'transferMaterial/cancel',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/transfer-material/${id}/cancel`, {
                method: 'POST',
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to cancel transfer material');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Download DN (Delivery Note)
export const downloadDN = createAsyncThunk(
    'transferMaterial/downloadDN',
    async (id: string, { rejectWithValue }) => {
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
            const response = await fetchWithAuth(`/api/warehouse/transfer-material/send-dn`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...dto }),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to send delivery note');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
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
                const inner = action.payload?.data;
                state.data = Array.isArray(inner?.data) ? inner.data : [];
                state.pagination = {
                    page: inner?.meta?.page || 1,
                    limit: inner?.meta?.limit || 50,
                    totalItems: inner?.meta?.totalItems || 0,
                    totalPages: inner?.meta?.totalPages || 0,
                };
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
                state.currentItem = action.payload;
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
                const index = state.data.findIndex(item => item.Id === action.payload.Id);
                if (index !== -1) {
                    state.data[index] = action.payload;
                }
                if (state.currentItem?.Id === action.payload.Id) {
                    state.currentItem = action.payload;
                }
            })
            // Delete
            .addCase(deleteTransferMaterial.fulfilled, (state, action) => {
                state.data = state.data.filter(item => item.Id !== action.payload?.Id);
            })
            // Pick
            .addCase(pickTransferMaterial.fulfilled, (state, action) => {
                const index = state.data.findIndex(item => item.Id === action.payload.Id);
                if (index !== -1) {
                    state.data[index] = action.payload;
                }
                if (state.currentItem?.Id === action.payload.Id) {
                    state.currentItem = action.payload;
                }
            })
            // Ship
            .addCase(shipTransferMaterial.fulfilled, (state, action) => {
                const index = state.data.findIndex(item => item.Id === action.payload.Id);
                if (index !== -1) {
                    state.data[index] = action.payload;
                }
                if (state.currentItem?.Id === action.payload.Id) {
                    state.currentItem = action.payload;
                }
            })
            // Receive
            .addCase(receiveTransferMaterial.fulfilled, (state, action) => {
                const index = state.data.findIndex(item => item.Id === action.payload.Id);
                if (index !== -1) {
                    state.data[index] = action.payload;
                }
                if (state.currentItem?.Id === action.payload.Id) {
                    state.currentItem = action.payload;
                }
            })
            // Cancel
            .addCase(cancelTransferMaterial.fulfilled, (state, action) => {
                const index = state.data.findIndex(item => item.Id === action.payload.Id);
                if (index !== -1) {
                    state.data[index] = action.payload;
                }
                if (state.currentItem?.Id === action.payload.Id) {
                    state.currentItem = action.payload;
                }
            });
    },
});

export const { clearCurrentItem, clearError } = transferMaterialSlice.actions;
export default transferMaterialSlice.reducer;