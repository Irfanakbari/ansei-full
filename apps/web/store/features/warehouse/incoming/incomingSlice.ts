/*By Irfan Akbari Vuteq Indonesia - 2026-06-08 - Updated 2026-07-14*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '@/store/utils/fetchWithAuth';
import { get, post, getApiErrorMessage, type ApiSuccessEnvelope, type PaginatedApiSuccessEnvelope } from '@/store/utils/apiService';

// Attachment entity interface
export interface AttachmentEntity {
    Id: number;
    IncomingId: string;
    FileName: string;
    FilePath: string;
    Description: string | null;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string;
    UpdatedAt?: string;
}

// Material data interface
export interface IncomingMaterialData {
    Id: number;
    PartNumber: string;
    PartName: string;
}

// Incoming material item
export interface IncomingMaterial {
    Id: number;
    MaterialId: number;
    Qty: number;
    QtyChecked?: number | null;  // Qty that has been checked/verified
    MaterialData: IncomingMaterialData | null;
}

// Supplier data interface
export interface SupplierData {
    Id: number;
    Name: string;
}

// Incoming entity interface
export interface IncomingEntity {
    Id: string;
    PoId: string;
    SupplierId: number;
    ReceivedBy: string;
    ReceivedByName?: string;
    Description: string | null;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string;
    UpdatedAt: string;
    ApprovedAt: string | null;
    ApprovedBy: string | null;
    ApprovedByName?: string | null;
    Closed: boolean;
    SupplierData: SupplierData;
    IncomingMaterial: IncomingMaterial[];
    FileName?: string | null;  // Attachment file name
    FilePath?: string | null;  // Attachment file path
}

// Incoming state
interface IncomingState {
    data: IncomingEntity[];
    detail: IncomingEntity | null;
    loading: boolean;
    detailLoading: boolean;
    error: string | null;
    attachments: Record<string, AttachmentEntity[]>; // key = incomingId
    attachmentLoading: boolean;
    query: IncomingQuery;
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}
export interface IncomingQuery { page?: number; limit?: number; search?: string; open?: boolean }

const initialState: IncomingState = {
    data: [],
    detail: null,
    loading: false,
    detailLoading: false,
    error: null,
    attachments: {},
    attachmentLoading: false,
    query: { page: 1, limit: 50 },
    pagination: { page: 1, limit: 50, totalItems: 0, totalPages: 0 },
};

// Fetch all incoming
export const fetchIncoming = createAsyncThunk<PaginatedApiSuccessEnvelope<IncomingEntity>, IncomingQuery | undefined, { rejectValue: string }>(
    'incoming/fetchAll',
    async (query = {}, { rejectWithValue }) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<IncomingEntity>>('/warehouse/incoming', { params: { page: query.page, limit: query.limit, search: query.search, open: query.open } });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch incoming data'));
        }
    }
);

// Fetch incoming by ID
export const fetchIncomingById = createAsyncThunk(
    'incoming/fetchById',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/incoming/${id}`);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch incoming detail');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Create incoming
export const createIncoming = createAsyncThunk(
    'incoming/create',
    async (incomingData: {
        poId: string;
        supplierId: number;
        receivedBy: string;
        description?: string;
        materials: { materialId: number; qty: number }[];
    }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/warehouse/incoming', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(incomingData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to create incoming');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Update incoming
export const updateIncoming = createAsyncThunk(
    'incoming/update',
    async ({ id, data: updateData }: {
        id: string;
        data: {
            supplierId?: number;
            receivedBy?: string;
            description?: string;
            materials?: { materialId: number; qty: number }[];
        }
    }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/incoming/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to update incoming');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Delete incoming
export const deleteIncoming = createAsyncThunk(
    'incoming/delete',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/incoming/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete incoming');
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Receive incoming
export const receiveIncoming = createAsyncThunk(
    'incoming/receive',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await post<ApiSuccessEnvelope<{ id: string; approvedAt: string; inventoryUpdated: boolean }>>(`/warehouse/incoming/${encodeURIComponent(id)}/receive`, {});
            return response.data;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to receive incoming'));
        }
    }
);

// Clear detail
export const clearIncomingDetail = createAsyncThunk(
    'incoming/clearDetail',
    async () => {}
);

// Fetch attachments for an incoming
export const fetchAttachments = createAsyncThunk(
    'incoming/fetchAttachments',
    async (incomingId: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/incoming/${incomingId}/attachments`);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch attachments');
            return { incomingId, attachments: Array.isArray(data) ? data : (data.data || []) };
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Upload attachment
export const uploadAttachment = createAsyncThunk(
    'incoming/uploadAttachment',
    async ({ incomingId, file, description }: { incomingId: string; file: File; description?: string }, { rejectWithValue }) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (description) {
                formData.append('description', description);
            }

            const response = await fetchWithAuth(`/api/warehouse/incoming/${incomingId}/attachments`, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Gagal upload lampiran');

            // After successful upload, update the Incoming entity in store with new FileName/FilePath
            return { incomingId, fileName: data.FileName, filePath: data.FilePath };
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Check incoming (material checking)
export const checkIncoming = createAsyncThunk(
    'incoming/check',
    async ({ id, materials }: { id: string; materials: { incomingMaterialId: number; qtyChecked: number }[] }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/incoming/${id}/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ materials }),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to check incoming');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Delete attachment
export const deleteAttachment = createAsyncThunk(
    'incoming/deleteAttachment',
    async ({ incomingId, attachmentId }: { incomingId: string; attachmentId: number }, { rejectWithValue }) => {
        try {
            // If attachmentId is 0, it means we need to clear FileName/FilePath from Incoming entity
            if (attachmentId === 0) {
                // Use PATCH to clear the attachment fields
                const response = await fetchWithAuth(`/api/warehouse/incoming/${incomingId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ FileName: null, FilePath: null }),
                });
                const data = await response.json();
                if (!response.ok) return rejectWithValue(data.message || 'Gagal hapus lampiran');
                return { incomingId };
            }

            const response = await fetchWithAuth(`/api/warehouse/incoming/attachments/${attachmentId}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Gagal hapus lampiran');
            return { incomingId, attachmentId };
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const incomingSlice = createSlice({
    name: 'incoming',
    initialState,
    reducers: {
        clearDetail: (state) => {
            state.detail = null;
        },
        setIncomingQuery: (state, action: { payload: IncomingQuery }) => { state.query = { ...state.query, ...action.payload }; },
    },
    extraReducers: (builder) => {
        builder
            // Fetch all
            .addCase(fetchIncoming.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchIncoming.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
                state.pagination = action.payload.meta ?? initialState.pagination;
            })
            .addCase(fetchIncoming.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Fetch by ID
            .addCase(fetchIncomingById.pending, (state) => { state.detailLoading = true; state.error = null; })
            .addCase(fetchIncomingById.fulfilled, (state, action) => {
                state.detailLoading = false;
                state.detail = action.payload;
            })
            .addCase(fetchIncomingById.rejected, (state, action) => {
                state.detailLoading = false;
                state.error = action.payload as string;
            })
            // Create
            .addCase(createIncoming.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(createIncoming.fulfilled, (state, action) => {
                state.loading = false;
                state.data.unshift(action.payload);
            })
            .addCase(createIncoming.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Update
            .addCase(updateIncoming.fulfilled, (state, action) => {
                const index = state.data.findIndex(item => item.Id === action.payload.Id);
                if (index !== -1) {
                    state.data[index] = action.payload;
                }
            })
            // Delete
            .addCase(deleteIncoming.fulfilled, (state, action) => {
                state.data = state.data.filter(item => item.Id !== action.payload);
            })
            // Receive
            .addCase(receiveIncoming.fulfilled, (state, action) => {
                const item = state.data.find(item => item.Id === action.payload.id);
                if (item) { item.Closed = true; item.ApprovedAt = action.payload.approvedAt; }
            })
            // Clear detail
            .addCase(clearIncomingDetail.fulfilled, (state) => {
                state.detail = null;
            })
            // Fetch attachments
            .addCase(fetchAttachments.pending, (state) => { state.attachmentLoading = true; })
            .addCase(fetchAttachments.fulfilled, (state, action) => {
                state.attachmentLoading = false;
                state.attachments[action.payload.incomingId] = action.payload.attachments;
            })
            .addCase(fetchAttachments.rejected, (state) => {
                state.attachmentLoading = false;
            })
            // Upload attachment
            .addCase(uploadAttachment.fulfilled, (state, action) => {
                const { incomingId, fileName, filePath } = action.payload;
                const incoming = state.data.find(item => item.Id === incomingId);
                if (incoming) {
                    incoming.FileName = fileName;
                    incoming.FilePath = filePath;
                }
            })
            // Delete attachment
            .addCase(deleteAttachment.fulfilled, (state, action) => {
                const { incomingId } = action.payload;
                const incoming = state.data.find(item => item.Id === incomingId);
                if (incoming) {
                    incoming.FileName = null;
                    incoming.FilePath = null;
                }
            })
            // Check incoming
            .addCase(checkIncoming.fulfilled, (state, action) => {
                const index = state.data.findIndex(item => item.Id === action.payload.Id);
                if (index !== -1) {
                    state.data[index] = action.payload;
                }
            });
    },
});

export const { clearDetail, setIncomingQuery } = incomingSlice.actions;
export default incomingSlice.reducer;
