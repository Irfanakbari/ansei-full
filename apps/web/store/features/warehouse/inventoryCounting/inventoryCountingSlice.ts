/*By Irfan Akbari Vuteq Indonesia - 2026-06-11 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { del, get, getApiErrorMessage, patch, post, postBlob } from '@/store/utils/apiService';

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
    OpnameNumber: string;
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
    opnameNumber: string;
    category: 'MATERIAL' | 'FINISH_GOOD';
    notes?: string;
}

// Update DTO
export interface UpdateInventoryCountingDto {
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
            return { success: true, id };
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
    { detailId: number; dto: UpdateActualStockDto },
    { rejectValue: string }
>(
    'inventoryCounting/updateActualStock',
    async ({ detailId, dto }: { detailId: number; dto: UpdateActualStockDto }, { rejectWithValue }) => {
        try {
            return await patch<{ success: boolean; data: InventoryCountingDetailEntity }>(
                `/inventory-counting/details/${detailId}`,
                dto
            );
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update actual stock'));
        }
    }
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
            const blob = await postBlob('/inventory-counting/generate-ws', { id: inventoryCountingId });
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

            return { success: true, filename };
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
    async ({ inventoryCountingId }, { rejectWithValue }) => {
        try {
            const blob = await postBlob('/inventory-counting/generate-temporary-report', { id: inventoryCountingId });
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

            return { success: true, filename };
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to download temporary report'));
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
            const blob = await postBlob('/inventory-counting/generate-snapshot', { id: inventoryCountingId });
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

            return { success: true, filename };
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to download snapshot'));
        }
    }
);

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
                    state.pagination = { page: 1, limit: 50, total: 0, totalPages: 0 };
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