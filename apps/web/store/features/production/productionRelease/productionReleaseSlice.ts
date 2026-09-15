/*By Irfan Akbari Vuteq Indonesia - 2026-06-08 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { get, getApiErrorMessage, type ApiSuccessEnvelope } from '@/store/utils/apiService';
import {fetchWithAuth} from "@/store/utils/fetchWithAuth";

// Forecast item interface
export interface AttachmentDelivery {
    id: number;
    FileName: string;
    FilePath: string;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string;
    UpdatedAt: string;
    ProductionReleaseId: string;
}

export interface ForecastItem {
    PoId: string;
    PoNumber?: string;
    FinishGoodId: string;
    Qty: number;
    DeliveryDate: string;
    PartData: {
        PartNumber: string;
        PartName: string;
    };
    Shopping: {
        QtyPick: number;
    }[];
    AttachmentDelivery?: AttachmentDelivery;
}

// Progress interfaces
export interface ProgressShopping {
    totalPicked: number;
    totalTarget: number;
    percentage: number;
}

export interface ProgressDelivery {
    total: number;
    scanned: number;
    pending: number;
    percentage: number;
}

export interface ProgressPokayoke {
    total: number;
    scanned: number;
    pending: number;
    percentage: number;
}

// Attachment interface (from Prisma deliveryAttachment)
export interface ProductionAttachment {
    id: number;
    ProductionReleaseId: string;
    ForecastId: string | null;
    FileName: string;
    FilePath: string;
    FileSize?: number;
    MimeType?: string;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string;
    UpdatedAt: string;
}

// Production release entity interface
export interface ProductionReleaseEntity {
    Id: string;
    ReleaseNumber: string;
    PlanDate: string;
    Status: string;
    Notes: string | null;
    IsNoAttachment: boolean;
    TotalTargetQty: number;
    TotalGoodQty: number;
    TotalNgQty: number;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string;
    UpdatedAt: string;
    Forecasts: ForecastItem[];
    Attachments?: ProductionAttachment[];
    _count?: {
        LabelDatas: number;
        Forecasts: number;
    };
    progressShopping?: ProgressShopping;
    progressDelivery?: ProgressDelivery;
    progressPokayoke?: ProgressPokayoke;
}

// Production release state
interface ProductionReleaseState {
    data: ProductionReleaseEntity[];
    detail: ProductionReleaseEntity | null;
    attachments: ProductionAttachment[];
    loading: boolean;
    detailLoading: boolean;
    attachmentLoading: boolean;
    error: string | null;
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}

const initialState: ProductionReleaseState = {
    data: [],
    detail: null,
    attachments: [],
    loading: false,
    detailLoading: false,
    attachmentLoading: false,
    error: null,
    pagination: { page: 1, limit: 50, totalItems: 0, totalPages: 0 },
};

export interface ProductionReleaseQuery {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
}

interface PaginatedProductionRelease {
    data: ProductionReleaseEntity[];
    meta: { page: number; limit: number; totalItems: number; totalPages: number };
}

// Fetch all production releases
export const fetchProductionRelease = createAsyncThunk<ApiSuccessEnvelope<PaginatedProductionRelease>, ProductionReleaseQuery | undefined, { rejectValue: string }>(
    'productionRelease/fetchAll',
    async (query = {}, { rejectWithValue }) => {
        try {
            return await get<ApiSuccessEnvelope<PaginatedProductionRelease>>('/production/production-release', {
                params: { page: query.page, limit: query.limit, search: query.search, status: query.status },
            });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch production release data'));
        }
    }
);

// Fetch production release by ID
export const fetchProductionReleaseById = createAsyncThunk(
    'productionRelease/fetchById',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/production/production-release/${id}`);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch production release detail');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Create production release
export const createProductionRelease = createAsyncThunk(
    'productionRelease/create',
    async (releaseData: {
        releaseNumber: string;
        planDate: string;
        notes?: string;
        forecastIds?: string[];
    }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/production/production-release', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(releaseData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to create production release');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Update production release
export const updateProductionRelease = createAsyncThunk(
    'productionRelease/update',
    async ({ id, data: updateData }: {
        id: string;
        data: {
            status?: string;
            notes?: string;
            forecastIds?: string[];
        }
    }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/production/production-release/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to update production release');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Delete production release
export const deleteProductionRelease = createAsyncThunk(
    'productionRelease/delete',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/production/production-release/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete production release');
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Fetch attachments for production release
export const fetchAttachments = createAsyncThunk(
    'productionRelease/fetchAttachments',
    async (productionReleaseId: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/production/production-release/${productionReleaseId}/attachments`);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Gagal mengambil data lampiran');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Upload attachment for production release
export const uploadAttachment = createAsyncThunk(
    'productionRelease/uploadAttachment',
    async ({ productionReleaseId, forecastId, file }: {
        productionReleaseId: string;
        forecastId?: string;
        file: File;
    }, { rejectWithValue }) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('productionReleaseId', productionReleaseId);
            if (forecastId) {
                formData.append('forecastId', forecastId);
            }

            const response = await fetchWithAuth(`/api/production/production-release/${productionReleaseId}/attachments`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Gagal upload lampiran');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Delete attachment
export const deleteAttachment = createAsyncThunk(
    'productionRelease/deleteAttachment',
    async (attachmentId: number, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/production/production-release/attachments/${attachmentId}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Gagal hapus lampiran');
            return attachmentId;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Clear detail
export const clearProductionReleaseDetail = createAsyncThunk(
    'productionRelease/clearDetail',
    async () => {}
);

const productionReleaseSlice = createSlice({
    name: 'productionRelease',
    initialState,
    reducers: {
        clearDetail: (state) => {
            state.detail = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch all
            .addCase(fetchProductionRelease.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchProductionRelease.fulfilled, (state, action) => {
                state.loading = false;
                const raw = action.payload as any;
                if (Array.isArray(raw?.data)) {
                    state.data = raw.data;
                    state.pagination = raw.meta ?? initialState.pagination;
                } else if (Array.isArray(raw?.data?.data)) {
                    state.data = raw.data.data;
                    state.pagination = raw.data.meta ?? initialState.pagination;
                } else {
                    state.data = [];
                    state.pagination = initialState.pagination;
                }
            })
            .addCase(fetchProductionRelease.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Fetch by ID
            .addCase(fetchProductionReleaseById.pending, (state) => { state.detailLoading = true; state.error = null; })
            .addCase(fetchProductionReleaseById.fulfilled, (state, action) => {
                state.detailLoading = false;
                state.detail = (action.payload as any)?.data || action.payload;
            })
            .addCase(fetchProductionReleaseById.rejected, (state, action) => {
                state.detailLoading = false;
                state.error = action.payload as string;
            })
            // Create
            .addCase(createProductionRelease.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(createProductionRelease.fulfilled, (state, action) => {
                state.loading = false;
                const created = (action.payload as any)?.data || action.payload;
                if (created && typeof created === 'object' && created.Id) {
                    state.data.unshift(created);
                }
            })
            .addCase(createProductionRelease.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Update
            .addCase(updateProductionRelease.fulfilled, (state, action) => {
                const updated = (action.payload as any)?.data || action.payload;
                if (updated && updated.Id) {
                    const index = state.data.findIndex(item => item.Id === updated.Id);
                    if (index !== -1) {
                        state.data[index] = updated;
                    }
                }
            })
            // Delete
            .addCase(deleteProductionRelease.fulfilled, (state, action) => {
                state.data = state.data.filter(item => item.Id !== action.payload);
            })
            // Fetch attachments
            .addCase(fetchAttachments.pending, (state) => { state.attachmentLoading = true; })
            .addCase(fetchAttachments.fulfilled, (state, action) => {
                state.attachmentLoading = false;
                state.attachments = Array.isArray(action.payload) ? action.payload : [];
            })
            .addCase(fetchAttachments.rejected, (state, action) => {
                state.attachmentLoading = false;
                state.error = action.payload as string;
            })
            // Upload attachment
            .addCase(uploadAttachment.pending, (state) => { state.attachmentLoading = true; })
            .addCase(uploadAttachment.fulfilled, (state, action) => {
                state.attachmentLoading = false;
                if (Array.isArray(state.attachments)) {
                    state.attachments.push(action.payload);
                }
            })
            .addCase(uploadAttachment.rejected, (state, action) => {
                state.attachmentLoading = false;
                state.error = action.payload as string;
            })
            // Delete attachment
            .addCase(deleteAttachment.fulfilled, (state, action) => {
                state.attachments = state.attachments.filter(item => item.id !== action.payload);
            })
            // Clear detail
            .addCase(clearProductionReleaseDetail.fulfilled, (state) => {
                state.detail = null;
            });
    },
});

export const { clearDetail } = productionReleaseSlice.actions;
export default productionReleaseSlice.reducer;