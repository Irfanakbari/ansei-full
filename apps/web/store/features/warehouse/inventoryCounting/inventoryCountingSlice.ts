/*By Irfan Akbari Vuteq Indonesia - 2026-06-11 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
    del,
    downloadFile,
    get,
    getApiErrorMessage,
    patch,
    post,
    postBlob,
    postFormData,
} from '@/store/utils/apiService';

// Entity interfaces - API returns PascalCase fields
export interface InventoryCountingDetailEntity {
    Id: number;
    OpnameId: string;
    MaterialId: string | null;
    FinishGoodId: string | null;
    Location: string;
    SystemQty: number;
    SystemQtyRack: number;
    ActualQty: number | null;
    ActualQtyRack: number | null;
    DiffQty: number | null;
    DiffQtyRack: number | null;
    Notes: string | null;
    MaterialData?: {
        PartNumber?: string;
        PartName?: string;
    } | null;
    FGData?: {
        PartNumber?: string;
        PartName?: string;
    } | null;
}

export interface InventoryCountingEntity {
    Id: string;
    RecordNumber: string;
    Category: 'MATERIAL' | 'FINISH_GOOD';
    Status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    Tolerance: number;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string;
    StartedAt?: string;
    CompletedAt?: string;
    CompletedBy?: string;
    Notes?: string;
    TotalItems?: number;
    CompletedItems?: number;
    _count?: {
        Details: number;
    };
}

export interface InventoryCountingAttachment {
    Id: number;
    FileName: string;
    FileSize: number;
    MimeType: string;
    CreatedAt: string;
    CreatedBy: string;
}

export interface OcrPreviewItem {
    partNumber: string;
    location: 'RACK' | 'WAREHOUSE' | 'FINISH_GOOD_AREA';
    actualQty: number;
    detailId: number | null;
    matchedPartNumber: string | null;
    status: 'MATCHED' | 'SUGGESTED' | 'DUPLICATE' | 'NOT_FOUND';
}

export interface OcrPreviewResponse {
    attachment: InventoryCountingAttachment | null;
    items: OcrPreviewItem[];
}

export interface InventoryCountingPackageStatus {
    generation: {status: string; error: {code: string; message: string} | null} | null;
    email: {status: string; error: {code: string; message: string} | null} | null;
    artifact: {Id: number; FileName: string; FileSize: number; CreatedAt: string} | null;
}

function normalizeInventoryCountingPackageStatus(value: unknown): InventoryCountingPackageStatus {
    const candidate = value && typeof value === 'object' && 'data' in value
        ? (value as {data?: unknown}).data
        : value;
    if (!candidate || typeof candidate !== 'object') {
        throw new Error('Document package status response is invalid.');
    }
    const status = candidate as Partial<InventoryCountingPackageStatus>;
    return {
        generation: status.generation ?? null,
        email: status.email ?? null,
        artifact: status.artifact ?? null,
    };
}

function normalizeInventoryCountingAttachments(
    value: unknown,
): InventoryCountingAttachment[] {
    if (Array.isArray(value)) return value as InventoryCountingAttachment[];
    if (
        value &&
        typeof value === 'object' &&
        Array.isArray((value as { data?: unknown }).data)
    ) {
        return (value as { data: InventoryCountingAttachment[] }).data;
    }
    return [];
}

function normalizeOcrPreview(value: unknown): OcrPreviewResponse {
    const candidate = value && typeof value === 'object'
    && 'data' in value
    && (value as { data?: unknown }).data
    && typeof (value as { data?: unknown }).data === 'object'
        ? (value as { data: unknown }).data
        : value;
    if (
        candidate &&
        typeof candidate === 'object' &&
        Array.isArray((candidate as { items?: unknown }).items)
    ) {
        const preview = candidate as OcrPreviewResponse;
        return {
            attachment: preview.attachment ?? null,
            items: preview.items,
        };
    }
    throw new Error('OCR preview response is invalid.');
}

// Response interfaces
export interface InventoryCountingResponse {
    success: boolean;
    processId: string;
    data: InventoryCountingEntity;
}

export interface PaginatedInventoryCounting {
    data: InventoryCountingEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// Query params
export interface InventoryCountingQuery {
    status?: string;
    category?: string;
    createdBy?: string;
    page?: number;
    limit?: number;
}

// Create DTO
export interface CreateInventoryCountingDto {
    category: 'MATERIAL' | 'FINISH_GOOD';
    tolerance?: number;
    notes?: string;
}

// Update DTO
export interface UpdateInventoryCountingDto {
    tolerance?: number;
    notes?: string;
}

// Generate Cutoff DTO
export interface GenerateCutOffDto {
    inventoryCountingId: string;
    itemCategory: 'MATERIAL' | 'FINISH_GOOD';
    location?: string;
    notes?: string;
}

// Update Actual Stock DTO
export interface UpdateActualStockDto {
    actualQty?: number;
    actualQtyRack?: number;
    notes?: string;
}

export interface BatchUpdateActualStockItemDto extends UpdateActualStockDto {
    detailId: number;
    actualQty: number;
}

// Close DTO
export interface CloseInventoryCountingDto {
    id: string;
    confirmedCheck: boolean;
    notes?: string;
}

// State interface
interface InventoryCountingState {
    data: InventoryCountingEntity[];
    currentItem: InventoryCountingEntity | null;
    details: InventoryCountingDetailEntity[];
    loading: boolean;
    detailLoading: boolean;
    error: string | null;
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    filters: InventoryCountingQuery;
}

// Initial state
const initialState: InventoryCountingState = {
    data: [],
    currentItem: null,
    details: [],
    loading: false,
    detailLoading: false,
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

// Fetch all inventory counting
export const fetchInventoryCounting = createAsyncThunk<
    PaginatedInventoryCounting,
    InventoryCountingQuery,
    { rejectValue: string }
>(
    'inventoryCounting/fetchAll',
    async (filters: InventoryCountingQuery, { rejectWithValue }) => {
        try {
            return await get<PaginatedInventoryCounting>('/inventory-counting', {
                params: {
                    page: filters.page,
                    limit: filters.limit,
                    status: filters.status || undefined,
                    category: filters.category || undefined,
                    createdBy: filters.createdBy || undefined,
                },
            });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch inventory counting data'));
        }
    }
);

// Fetch single inventory counting
export const fetchInventoryCountingById = createAsyncThunk<
    InventoryCountingEntity,
    string,
    { rejectValue: string }
>(
    'inventoryCounting/fetchById',
    async (id: string, { rejectWithValue }) => {
        try {
            return await get<InventoryCountingEntity>(`/inventory-counting/${id}`);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch inventory counting detail'));
        }
    }
);

// Fetch details for inventory counting
export const fetchInventoryCountingDetails = createAsyncThunk<
    InventoryCountingDetailEntity[],
    string,
    { rejectValue: string }
>(
    'inventoryCounting/fetchDetails',
    async (id: string, { rejectWithValue }) => {
        try {
            return await get<InventoryCountingDetailEntity[]>(`/inventory-counting/${id}/details`);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch detail items'));
        }
    }
);

// Create inventory counting
export const createInventoryCounting = createAsyncThunk<
    InventoryCountingResponse,
    CreateInventoryCountingDto,
    { rejectValue: string }
>(
    'inventoryCounting/create',
    async (dto: CreateInventoryCountingDto, { rejectWithValue }) => {
        try {
            return await post<InventoryCountingResponse>('/inventory-counting', dto);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create inventory counting'));
        }
    }
);

// Update inventory counting (notes)
export const updateInventoryCounting = createAsyncThunk<
    InventoryCountingResponse,
    { id: string; dto: UpdateInventoryCountingDto },
    { rejectValue: string }
>(
    'inventoryCounting/update',
    async ({ id, dto }: { id: string; dto: UpdateInventoryCountingDto }, { rejectWithValue }) => {
        try {
            return await patch<InventoryCountingResponse>(`/inventory-counting/${id}`, dto);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update inventory counting'));
        }
    }
);

// Delete inventory counting
export const deleteInventoryCounting = createAsyncThunk<
    { success: boolean; id: string },
    string,
    { rejectValue: string }
>(
    'inventoryCounting/delete',
    async (id: string, { rejectWithValue }) => {
        try {
            await del<{ success: boolean; message: string }>(`/inventory-counting/${id}`);
            return {success: true, id};
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete inventory counting'));
        }
    }
);

// Start inventory counting
export const startInventoryCounting = createAsyncThunk<
    InventoryCountingResponse,
    string,
    { rejectValue: string }
>(
    'inventoryCounting/start',
    async (id: string, { rejectWithValue }) => {
        try {
            return await post<InventoryCountingResponse>(`/inventory-counting/${id}/start`, {});
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to start inventory counting'));
        }
    }
);

// Generate cutoff items
export const generateCutOff = createAsyncThunk<
    { success: boolean; count: number },
    GenerateCutOffDto,
    { rejectValue: string }
>(
    'inventoryCounting/generateCutOff',
    async (dto: GenerateCutOffDto, { rejectWithValue }) => {
        try {
            return await post<{ success: boolean; count: number }>('/inventory-counting/generate-cutoff', dto);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to generate cutoff items'));
        }
    }
);

// Update actual stock
export const updateActualStock = createAsyncThunk<
    { success: boolean; data: InventoryCountingDetailEntity },
    { inventoryCountingId: string; detailId: number; dto: UpdateActualStockDto },
    { rejectValue: string }
>(
    'inventoryCounting/updateActualStock',
    async ({ inventoryCountingId, detailId, dto }, { rejectWithValue }) => {
        try {
            return await patch<{ success: boolean; data: InventoryCountingDetailEntity }>(
                `/inventory-counting/${inventoryCountingId}/details/${detailId}`,
                dto
            );
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update actual stock'));
        }
    }
);

export const batchUpdateActualStock = createAsyncThunk<
    { success: boolean; data: InventoryCountingDetailEntity[] },
    { inventoryCountingId: string; items: BatchUpdateActualStockItemDto[] },
    { rejectValue: string }
>(
    'inventoryCounting/batchUpdateActualStock',
    async ({ inventoryCountingId, items }, { rejectWithValue }) => {
        try {
            return await patch<{ success: boolean; data: InventoryCountingDetailEntity[] }>(
                `/inventory-counting/${inventoryCountingId}/details/batch`,
                {items}
            );
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update actual stock'));
        }
    }
);

export const fetchInventoryCountingAttachments = createAsyncThunk<
    InventoryCountingAttachment[],
    string,
    { rejectValue: string }
>(
    'inventoryCounting/fetchAttachments',
    async (id, { rejectWithValue }) => {
        try {
            const response = await get<unknown>(`/inventory-counting/${id}/attachments`);
            return normalizeInventoryCountingAttachments(response);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch inventory counting attachments'));
        }
    },
);

export const uploadInventoryCountingAttachments = createAsyncThunk<
    InventoryCountingAttachment[],
    { id: string; files: File[] },
    { rejectValue: string }
>(
    'inventoryCounting/uploadAttachments',
    async ({id, files}, { rejectWithValue }) => {
        try {
            const formData = new FormData();
            files.forEach((file) => formData.append('files', file));
            const response = await postFormData<unknown>(
                `/inventory-counting/${id}/attachments`,
                formData,
            );
            return normalizeInventoryCountingAttachments(response);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to upload inventory counting attachments'));
        }
    },
);

export const previewInventoryCountingOcr = createAsyncThunk<
    OcrPreviewResponse,
    { id: string; file: File },
    { rejectValue: string }
>(
    'inventoryCounting/previewOcr',
    async ({id, file}, { rejectWithValue }) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await postFormData<unknown>(
                `/inventory-counting/${id}/ocr/preview`,
                formData,
                {timeout: 120000},
            );
            return normalizeOcrPreview(response);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to read the inventory counting PDF'));
        }
    },
);

export const applyInventoryCountingOcr = createAsyncThunk<
    { success: boolean; updatedCount: number },
    {
        id: string;
        results: Array<{
            detailId: number;
            partNumber: string;
            location: OcrPreviewItem['location'];
            actualQty: number;
        }>;
    },
    { rejectValue: string }
>(
    'inventoryCounting/applyOcr',
    async ({id, results}, { rejectWithValue }) => {
        try {
            return await post<{ success: boolean; updatedCount: number }>(
                `/inventory-counting/${id}/ocr/apply`,
                {results},
            );
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to apply OCR results'));
        }
    },
);

export const downloadInventoryCountingAttachment = createAsyncThunk<
    void,
    { id: string; attachment: InventoryCountingAttachment },
    { rejectValue: string }
>(
    'inventoryCounting/downloadAttachment',
    async ({id, attachment}, { rejectWithValue }) => {
        try {
            await downloadFile(
                `/inventory-counting/${id}/attachments/${attachment.Id}/download`,
                attachment.FileName,
            );
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to download inventory counting attachment'));
        }
    },
);

export const deleteInventoryCountingAttachment = createAsyncThunk<
    { deleted: boolean; id: number },
    { id: string; attachmentId: number },
    { rejectValue: string }
>(
    'inventoryCounting/deleteAttachment',
    async ({id, attachmentId}, { rejectWithValue }) => {
        try {
            return await del<{ deleted: boolean; id: number }>(
                `/inventory-counting/${id}/attachments/${attachmentId}`,
            );
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete inventory counting attachment'));
        }
    },
);

// Close inventory counting
export const closeInventoryCounting = createAsyncThunk<
    InventoryCountingResponse,
    CloseInventoryCountingDto,
    { rejectValue: string }
>(
    'inventoryCounting/close',
    async (dto: CloseInventoryCountingDto, { rejectWithValue }) => {
        try {
            return await post<InventoryCountingResponse>('/inventory-counting/close', dto);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to close inventory counting'));
        }
    }
);

// Download Worksheet Excel - returns blob directly for download
export const downloadWorksheet = createAsyncThunk<
    { success: boolean; filename: string },
    string,
    { rejectValue: string }
>(
    'inventoryCounting/downloadWorksheet',
    async (inventoryCountingId: string, { rejectWithValue }) => {
        try {
            const blob = await postBlob('/inventory-counting/generate-ws', {id: inventoryCountingId});
            const filename = `Inventory_Worksheet_${inventoryCountingId}.xlsx`;

            // Trigger download directly
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            return {success: true, filename};
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to download worksheet'));
        }
    }
);

// Generate Temporary Report
export const generateTemporaryReport = createAsyncThunk<
    { success: boolean; filename: string },
    { inventoryCountingId: string },
    { rejectValue: string }
>(
    'inventoryCounting/generateTemporaryReport',
    async ({inventoryCountingId}, { rejectWithValue }) => {
        try {
            const blob = await postBlob('/inventory-counting/generate-temporary-report', {id: inventoryCountingId});
            const filename = `Inventory_Temporary_Report_${inventoryCountingId}.xlsx`;

            // Trigger download directly
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            return {success: true, filename};
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to download temporary report'));
        }
    }
);

// Generate Final Report
export const generateFinalReport = createAsyncThunk<
    { success: boolean; filename: string },
    { inventoryCountingId: string },
    { rejectValue: string }
>(
    'inventoryCounting/generateFinalReport',
    async ({inventoryCountingId}, { rejectWithValue }) => {
        try {
            const blob = await postBlob('/inventory-counting/generate-final-report', {id: inventoryCountingId});
            const filename = `Inventory_Final_Report_${inventoryCountingId}.xlsx`;
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(anchor);

            return {success: true, filename};
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to download final report'));
        }
    }
);

// Download Snapshot Excel
export const downloadSnapshot = createAsyncThunk<
    { success: boolean; filename: string },
    string,
    { rejectValue: string }
>(
    'inventoryCounting/downloadSnapshot',
    async (inventoryCountingId: string, { rejectWithValue }) => {
        try {
            const blob = await postBlob('/inventory-counting/generate-snapshot', {id: inventoryCountingId});
            const filename = `Inventory_Snapshot_${inventoryCountingId}.xlsx`;

            // Trigger download directly
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            return {success: true, filename};
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to download snapshot'));
        }
    }
);

export const generateInventoryCountingPackage = createAsyncThunk<
    {status: string},
    string,
    {rejectValue: string}
>('inventoryCounting/generatePackage', async (id, {rejectWithValue}) => {
    try {
        return await post<{status: string}>(`/inventory-counting/${id}/document-package/generate`, {});
    } catch (error: unknown) {
        return rejectWithValue(getApiErrorMessage(error, 'Failed to queue document package'));
    }
});

export const fetchInventoryCountingPackageStatus = createAsyncThunk<
    InventoryCountingPackageStatus,
    string,
    {rejectValue: string}
>('inventoryCounting/packageStatus', async (id, {rejectWithValue}) => {
    try {
        const response = await get<unknown>(`/inventory-counting/${id}/document-package`);
        return normalizeInventoryCountingPackageStatus(response);
    } catch (error: unknown) {
        return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch document package status'));
    }
});

export const downloadInventoryCountingPackage = createAsyncThunk<void, string, {rejectValue: string}>(
    'inventoryCounting/downloadPackage',
    async (id, {rejectWithValue}) => {
        try {
            await downloadFile(`/inventory-counting/${id}/document-package/download`, `Inventory_Counting_${id}.zip`);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to download document package'));
        }
    },
);

export const sendInventoryCountingPackageEmail = createAsyncThunk<
    {status: string},
    {id: string; recipients: string[]; subject?: string; message?: string},
    {rejectValue: string}
>('inventoryCounting/sendPackageEmail', async ({id, recipients, subject, message}, {rejectWithValue}) => {
    try {
        return await post<{status: string}>(`/inventory-counting/${id}/document-package/email`, {recipients, subject, message});
    } catch (error: unknown) {
        return rejectWithValue(getApiErrorMessage(error, 'Failed to queue document package email'));
    }
});

// Slice
const inventoryCountingSlice = createSlice({
    name: 'inventoryCounting',
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
        clearCurrentItem: (state) => {
            state.currentItem = null;
            state.details = [];
        },
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch all
            .addCase(fetchInventoryCounting.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchInventoryCounting.fulfilled, (state, action) => {
                state.loading = false;
                const raw = action.payload as any;
                if (Array.isArray(raw?.data)) {
                    state.data = raw.data;
                    state.pagination = {
                        page: raw.meta?.page || 1,
                        limit: raw.meta?.limit || 50,
                        total: raw.meta?.totalItems ?? raw.meta?.total ?? 0,
                        totalPages: raw.meta?.totalPages || 0,
                    };
                } else if (Array.isArray(raw?.data?.data)) {
                    state.data = raw.data.data;
                    state.pagination = {
                        page: raw.data.meta?.page || raw.data.page || 1,
                        limit: raw.data.meta?.limit || raw.data.limit || 50,
                        total: raw.data.meta?.totalItems ?? raw.data.total ?? 0,
                        totalPages: raw.data.meta?.totalPages || raw.data.totalPages || 0,
                    };
                } else {
                    state.data = [];
                    state.pagination = {page: 1, limit: 50, total: 0, totalPages: 0};
                }
            })
            .addCase(fetchInventoryCounting.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Fetch by ID
            .addCase(fetchInventoryCountingById.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchInventoryCountingById.fulfilled, (state, action) => {
                state.loading = false;
                state.currentItem = action.payload;
            })
            .addCase(fetchInventoryCountingById.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Fetch details
            .addCase(fetchInventoryCountingDetails.pending, (state) => {
                state.detailLoading = true;
                state.error = null;
            })
            .addCase(fetchInventoryCountingDetails.fulfilled, (state, action) => {
                state.detailLoading = false;
                // API returns array directly, not { data: [...] }
                state.details = Array.isArray(action.payload) ? action.payload : (action.payload as any)?.data || [];
            })
            .addCase(fetchInventoryCountingDetails.rejected, (state, action) => {
                state.detailLoading = false;
                state.error = action.payload as string;
            })
            // Create
            .addCase(createInventoryCounting.fulfilled, (state, action) => {
                state.data.unshift(action.payload.data);
            })
            // Update
            .addCase(updateInventoryCounting.fulfilled, (state, action) => {
                const index = state.data.findIndex(item => item.Id === action.payload.data.Id);
                if (index !== -1) {
                    state.data[index] = action.payload.data;
                }
                if (state.currentItem?.Id === action.payload.data.Id) {
                    state.currentItem = action.payload.data;
                }
            })
            // Delete
            .addCase(deleteInventoryCounting.fulfilled, (state, action) => {
                state.data = state.data.filter(item => item.Id !== action.payload.id);
            })
            // Start
            .addCase(startInventoryCounting.fulfilled, (state, action) => {
                const index = state.data.findIndex(item => item.Id === action.payload.data.Id);
                if (index !== -1) {
                    state.data[index] = action.payload.data;
                }
                if (state.currentItem?.Id === action.payload.data.Id) {
                    state.currentItem = action.payload.data;
                }
            })
            // Generate cutoff
            .addCase(generateCutOff.fulfilled, () => {
                // Refresh current item details after generating
            })
            // Update actual stock
            .addCase(updateActualStock.fulfilled, (state, action) => {
                const index = state.details.findIndex(d => d.Id === action.payload.data.Id);
                if (index !== -1) {
                    state.details[index] = {
                        ...state.details[index],
                        ActualQty: action.payload.data.ActualQty,
                        ActualQtyRack: action.payload.data.ActualQtyRack,
                        DiffQty: action.payload.data.DiffQty,
                        DiffQtyRack: action.payload.data.DiffQtyRack,
                        Notes: action.payload.data.Notes,
                    };
                }
            })
            .addCase(batchUpdateActualStock.fulfilled, (state, action) => {
                action.payload.data.forEach((updated) => {
                    const index = state.details.findIndex(detail => detail.Id === updated.Id);
                    if (index !== -1) state.details[index] = updated;
                });
            })
            // Close
            .addCase(closeInventoryCounting.fulfilled, (state, action) => {
                const index = state.data.findIndex(item => item.Id === action.payload.data.Id);
                if (index !== -1) {
                    state.data[index] = action.payload.data;
                }
                if (state.currentItem?.Id === action.payload.data.Id) {
                    state.currentItem = action.payload.data;
                }
            });
    },
});

export const {setFilters, resetFilters, clearCurrentItem, clearError} = inventoryCountingSlice.actions;
export default inventoryCountingSlice.reducer;
