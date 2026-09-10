/*By Irfan Akbari Vuteq Indonesia - 2026-06-08 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {fetchWithAuth} from "@/store/utils/fetchWithAuth";

// Material data interface
export interface MaterialData {
    Id: number;
    PartNumber: string;
    PartName: string;
    QtyRack: number;
}

// Forecast data interface
export interface ForecastData {
    Id: number;
    PoId: string;
    Date: string;
    VendorCode: string;
    VendorName: string;
    ReceivingArea: string;
    DeliveryDate: string;
    DeliveryPeriod: number;
    Classification: string;
    PoNumber: string;
    Item: number;
    Qty: number;
    FinishGoodId: string;
}

// Shopping entity interface
export interface ShoppingEntity {
    Id: string;
    ForecastId: string;
    MaterialId: string;
    QtyPick: number;
    Type: string;
    Description: string | null;
    CreatedAt: string;
    UpdatedAt: string;
    CreatedBy: string;
    MaterialData: MaterialData;
    ForecastData: ForecastData;
}

// Shopping Status Response
export interface BOMSummaryItem {
    materialId: string;
    materialName: string;
    bomQtyPerUnit: number;
    totalRequired: number;
    alreadyPicked: number;
    remainingToPick: number;
    isCompleted: boolean;
}

export interface ShoppingProgress {
    totalMaterials: number;
    completedMaterials: number;
    totalPickedPercent: number;
}

export interface ShoppingStatusResponse {
    forecastId: string;
    finishGoodId: string;
    finishGoodName: string;
    forecastQty: number;
    status: string;
    bomSummary: BOMSummaryItem[];
    progress: ShoppingProgress;
}

// Check Requirement interfaces
export interface RequirementItem {
    materialId: string;
    materialName: string;
    bomQtyPerUnit: number;
    qtyNeeded: number;
    qtyPicked: number;
    qtyRemaining: number;
    isCompleted: boolean;
}

export interface CheckRequirementSummary {
    totalMaterials: number;
    completedMaterials: number;
    totalQtyNeeded: number;
    totalQtyPicked: number;
    totalQtyRemaining: number;
    overallPercentage: number;
}

export interface CheckRequirementResponse {
    forecastId: string;
    finishGoodId: string;
    finishGoodName: string;
    forecastQty: number;
    productionReleaseStatus: string | null;
    requirements: RequirementItem[];
    summary: CheckRequirementSummary;
}

// Shopping state
interface ShoppingState {
    data: ShoppingEntity[];
    detail: ShoppingEntity | null;
    loading: boolean;
    detailLoading: boolean;
    checkLoading: boolean;
    error: string | null;
    checkRequirement: CheckRequirementResponse | null;
}

const initialState: ShoppingState = {
    data: [],
    detail: null,
    loading: false,
    detailLoading: false,
    checkLoading: false,
    error: null,
    checkRequirement: null,
};

// Fetch all shopping
export const fetchShopping = createAsyncThunk(
    'shopping/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/production/shopping');
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch shopping data');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Fetch shopping by ID
export const fetchShoppingById = createAsyncThunk(
    'shopping/fetchById',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/production/shopping/${id}`);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch shopping detail');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Create shopping
export const createShopping = createAsyncThunk(
    'shopping/create',
    async (shoppingData: {
        forecastId: string;
        materialId: string;
        qtyPick: number;
        type: 'REGULER' | 'ADDITIONAL';
        description?: string;
    }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/production/shopping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(shoppingData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to create shopping');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Delete shopping
export const deleteShopping = createAsyncThunk(
    'shopping/delete',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/production/shopping/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete shopping');
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Clear detail
export const clearShoppingDetail = createAsyncThunk(
    'shopping/clearDetail',
    async () => {}
);

// Fetch shopping status by forecast ID
export const fetchShoppingStatus = createAsyncThunk(
    'shopping/fetchStatus',
    async (forecastId: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/production/shopping/forecast/${forecastId}/status`);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch shopping status');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Fetch check requirement by forecast ID (PoId)
export const fetchCheckRequirement = createAsyncThunk(
    'shopping/fetchCheckRequirement',
    async (forecastId: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/production/shopping/check-requirement/${forecastId}`);
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch check requirement');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const shoppingSlice = createSlice({
    name: 'shopping',
    initialState,
    reducers: {
        clearDetail: (state) => {
            state.detail = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch all
            .addCase(fetchShopping.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchShopping.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
            })
            .addCase(fetchShopping.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Fetch by ID
            .addCase(fetchShoppingById.pending, (state) => { state.detailLoading = true; state.error = null; })
            .addCase(fetchShoppingById.fulfilled, (state, action) => {
                state.detailLoading = false;
                state.detail = action.payload;
            })
            .addCase(fetchShoppingById.rejected, (state, action) => {
                state.detailLoading = false;
                state.error = action.payload as string;
            })
            // Create
            .addCase(createShopping.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(createShopping.fulfilled, (state, action) => {
                state.loading = false;
                state.data.unshift(action.payload);
            })
            .addCase(createShopping.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Delete
            .addCase(deleteShopping.fulfilled, (state, action) => {
                state.data = state.data.filter(item => item.Id !== action.payload);
            })
            // Clear detail
            .addCase(clearShoppingDetail.fulfilled, (state) => {
                state.detail = null;
            })
            // Fetch check requirement
            .addCase(fetchCheckRequirement.pending, (state) => {
                state.checkLoading = true;
                state.error = null;
            })
            .addCase(fetchCheckRequirement.fulfilled, (state, action) => {
                state.checkLoading = false;
                state.checkRequirement = action.payload;
            })
            .addCase(fetchCheckRequirement.rejected, (state, action) => {
                state.checkLoading = false;
                state.checkRequirement = null;
                state.error = action.payload as string;
            });
    },
});

export const { clearDetail } = shoppingSlice.actions;
export default shoppingSlice.reducer;