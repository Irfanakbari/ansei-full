/*By Irfan Akbari Vuteq Indonesia - 2026-06-08 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  del,
  get,
  getApiErrorMessage,
  post,
  type ApiSuccessEnvelope,
  type PaginatedApiSuccessEnvelope,
} from "@/store/utils/apiService";

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
  Purpose: string;
  Id: string;
  ForecastId: string;
  MaterialId: string;
  QtyPick: number;
  Type: string;
  Description: string | null;
  Destination?: string | null;
  CreatedAt: string;
  UpdatedAt: string;
  CreatedBy: string;
  CreatedByName?: string;
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
  standardRequired: number;
  standardIssued: number;
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
  snapshotId: string;
  bomRevision: number;
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
  query: ShoppingQuery;
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}
export interface ShoppingQuery {
  scope?: "OPERATIONS";
  purpose?: string;
  page?: number;
  limit?: number;
  search?: string;
}

const initialState: ShoppingState = {
  data: [],
  detail: null,
  loading: false,
  detailLoading: false,
  checkLoading: false,
  error: null,
  checkRequirement: null,
  query: { page: 1, limit: 50, scope: "OPERATIONS" },
  pagination: { page: 1, limit: 50, totalItems: 0, totalPages: 0 },
};

// Fetch all shopping
export const fetchShopping = createAsyncThunk<
  PaginatedApiSuccessEnvelope<ShoppingEntity>,
  ShoppingQuery | undefined,
  { rejectValue: string }
>("shopping/fetchAll", async (query = {}, { rejectWithValue }) => {
  try {
    return await get<PaginatedApiSuccessEnvelope<ShoppingEntity>>(
      "/production/shopping",
      { params: { ...query } },
    );
  } catch (error: unknown) {
    return rejectWithValue(
      getApiErrorMessage(error, "Failed to fetch shopping data"),
    );
  }
});

// Fetch shopping by ID
export const fetchShoppingById = createAsyncThunk(
  "shopping/fetchById",
  async (id: string, { rejectWithValue }) => {
    try {
      return await get<ApiSuccessEnvelope<ShoppingEntity>>(
        `/production/shopping/${id}`,
      );
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to fetch shopping detail"),
      );
    }
  },
);

// Create shopping
export const createShopping = createAsyncThunk(
  "shopping/create",
  async (
    shoppingData: {
      requestId: string;
      purpose: "STANDARD" | "NON_PRODUCTION";
      snapshotId?: string;
      destination?: string;
      forecastId?: string | null;
      materialId: string;
      qtyPick: number;
      type: "REGULER" | "ADDITIONAL";
      description?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      return await post<
        ApiSuccessEnvelope<ShoppingEntity>,
        typeof shoppingData
      >("/production/shopping", shoppingData);
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to create shopping"),
      );
    }
  },
);

// Delete shopping
export const deleteShopping = createAsyncThunk(
  "shopping/delete",
  async (id: string, { rejectWithValue }) => {
    try {
      await del<ApiSuccessEnvelope<unknown>>(`/production/shopping/${id}`);
      return id;
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to delete shopping"),
      );
    }
  },
);

// Clear detail
export const clearShoppingDetail = createAsyncThunk(
  "shopping/clearDetail",
  async () => {},
);

// Fetch shopping status by forecast ID
export const fetchShoppingStatus = createAsyncThunk<
  ShoppingStatusResponse,
  string,
  { rejectValue: string }
>("shopping/fetchStatus", async (forecastId: string, { rejectWithValue }) => {
  try {
    const response = await get<ApiSuccessEnvelope<ShoppingStatusResponse>>(
      `/production/shopping/forecast/${forecastId}/status`,
    );
    return response.data;
  } catch (error: unknown) {
    return rejectWithValue(
      getApiErrorMessage(error, "Failed to fetch shopping status"),
    );
  }
});

// Fetch check requirement by forecast ID (PoId)
export const fetchCheckRequirement = createAsyncThunk(
  "shopping/fetchCheckRequirement",
  async (forecastId: string, { rejectWithValue }) => {
    try {
      return await get<ApiSuccessEnvelope<CheckRequirementResponse>>(
        `/production/shopping/check-requirement/${forecastId}`,
      );
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to fetch check requirement"),
      );
    }
  },
);

const shoppingSlice = createSlice({
  name: "shopping",
  initialState,
  reducers: {
    clearDetail: (state) => {
      state.detail = null;
    },
    setShoppingQuery: (state, action: { payload: ShoppingQuery }) => {
      state.query = { ...state.query, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchShopping.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchShopping.fulfilled, (state, action) => {
        state.loading = false;
        state.data = Array.isArray(action.payload?.data)
          ? action.payload.data
          : [];
        state.pagination = action.payload.meta ?? initialState.pagination;
      })
      .addCase(fetchShopping.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch by ID
      .addCase(fetchShoppingById.pending, (state) => {
        state.detailLoading = true;
        state.error = null;
      })
      .addCase(fetchShoppingById.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.detail = action.payload.data;
      })
      .addCase(fetchShoppingById.rejected, (state, action) => {
        state.detailLoading = false;
        state.error = action.payload as string;
      })
      // Create
      .addCase(createShopping.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createShopping.fulfilled, (state, action) => {
        state.loading = false;
        state.data.unshift(action.payload.data);
      })
      .addCase(createShopping.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Delete
      .addCase(deleteShopping.fulfilled, (state, action) => {
        state.data = state.data.filter((item) => item.Id !== action.payload);
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
        state.checkRequirement = action.payload.data;
      })
      .addCase(fetchCheckRequirement.rejected, (state, action) => {
        state.checkLoading = false;
        state.checkRequirement = null;
        state.error = action.payload as string;
      });
  },
});

export const { clearDetail, setShoppingQuery } = shoppingSlice.actions;
export default shoppingSlice.reducer;
