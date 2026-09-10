/*By Irfan Akbari Vuteq Indonesia - 2026-06-11 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '@/store/utils/fetchWithAuth';
import { getTokenFromCookie } from '@/app/api/auth/_lib/token-client';

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
}

export interface InventoryCountingEntity {
    Id: string;
    OpnameNumber: string;
    Category: 'MATERIAL' | 'FINISH_GOOD';
    Status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    CreatedAt: string;
    CreatedBy: string;
    StartedAt: string | null;
    CompletedAt: string | null;
    CompletedBy: string | null;
    Notes: string | null;
    Details?: InventoryCountingDetailEntity[];
    TotalItems?: number;
    CompletedItems?: number;
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
export const fetchInventoryCounting = createAsyncThunk(
    'inventoryCounting/fetchAll',
    async (filters: InventoryCountingQuery, { rejectWithValue }) => {
        try {
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.category) params.append('category', filters.category);
            if (filters.createdBy) params.append('createdBy', filters.createdBy);
            if (filters.page) params.append('page', String(filters.page));
            if (filters.limit) params.append('limit', String(filters.limit));

            const queryString = params.toString();
            const url = `/api/warehouse/inventory-counting${queryString ? `?${queryString}` : ''}`;

            const response = await fetchWithAuth(url);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch inventory counting data');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Fetch single inventory counting
export const fetchInventoryCountingById = createAsyncThunk(
    'inventoryCounting/fetchById',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/inventory-counting/${id}`);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch inventory counting detail');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Fetch details for inventory counting
export const fetchInventoryCountingDetails = createAsyncThunk(
    'inventoryCounting/fetchDetails',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/inventory-counting/${id}/details`);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch detail items');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Create inventory counting
export const createInventoryCounting = createAsyncThunk(
    'inventoryCounting/create',
    async (dto: CreateInventoryCountingDto, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/warehouse/inventory-counting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dto),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to create inventory counting');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Update inventory counting (notes)
export const updateInventoryCounting = createAsyncThunk(
    'inventoryCounting/update',
    async ({ id, dto }: { id: string; dto: UpdateInventoryCountingDto }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/inventory-counting/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dto),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to update inventory counting');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Delete inventory counting
export const deleteInventoryCounting = createAsyncThunk(
    'inventoryCounting/delete',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/inventory-counting/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete inventory counting');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Start inventory counting
export const startInventoryCounting = createAsyncThunk(
    'inventoryCounting/start',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/inventory-counting/${id}/start`, {
                method: 'POST',
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to start inventory counting');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Generate cutoff items
export const generateCutOff = createAsyncThunk(
    'inventoryCounting/generateCutOff',
    async (dto: GenerateCutOffDto, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/warehouse/inventory-counting/generate-cutoff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dto),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to generate cutoff items');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Update actual stock
export const updateActualStock = createAsyncThunk(
    'inventoryCounting/updateActualStock',
    async ({ detailId, dto }: { detailId: number; dto: UpdateActualStockDto }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/warehouse/inventory-counting/details/${detailId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dto),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to update actual stock');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Close inventory counting
export const closeInventoryCounting = createAsyncThunk(
    'inventoryCounting/close',
    async (dto: CloseInventoryCountingDto, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/warehouse/inventory-counting/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dto),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to close inventory counting');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Download Worksheet Excel - returns blob directly for download
export const downloadWorksheet = createAsyncThunk(
    'inventoryCounting/downloadWorksheet',
    async (inventoryCountingId: string, { rejectWithValue }) => {
        try {
            const token = await getTokenFromCookie();
            if (!token) {
                return rejectWithValue('No authentication token found');
            }

            const response = await fetch('/api/warehouse/inventory-counting/generate-ws', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id: inventoryCountingId }),
                credentials: 'include',
            });

            if (!response.ok) {
                const data = await response.json();
                return rejectWithValue(data.message || 'Failed to download worksheet');
            }

            const blob = await response.blob();
            const filename = `worksheet-${inventoryCountingId}.xlsx`;

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
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Download Snapshot Excel
export const downloadSnapshot = createAsyncThunk(
    'inventoryCounting/downloadSnapshot',
    async (inventoryCountingId: string, { rejectWithValue }) => {
        try {
            const token = await getTokenFromCookie();
            if (!token) {
                return rejectWithValue('No authentication token found');
            }

            const response = await fetch('/api/warehouse/inventory-counting/generate-snapshot', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id: inventoryCountingId }),
                credentials: 'include',
            });

            if (!response.ok) {
                const data = await response.json();
                return rejectWithValue(data.message || 'Failed to download snapshot');
            }

            const blob = await response.blob();
            const filename = `snapshot-${inventoryCountingId}.xlsx`;

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
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Slice
const inventoryCountingSlice = createSlice({
    name: 'inventoryCounting',
    initialState,
    reducers: {
        setFilters: (state, action) => {
            state.filters = { ...state.filters, ...action.payload };
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
                state.data = action.payload.data || [];
                state.pagination = {
                    page: action.payload.page || 1,
                    limit: action.payload.limit || 50,
                    total: action.payload.total || 0,
                    totalPages: action.payload.totalPages || 0,
                };
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
                state.data = state.data.filter(item => item.Id !== action.payload.data?.Id);
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
            .addCase(generateCutOff.fulfilled, (state, action) => {
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

export const { setFilters, resetFilters, clearCurrentItem, clearError } = inventoryCountingSlice.actions;
export default inventoryCountingSlice.reducer;