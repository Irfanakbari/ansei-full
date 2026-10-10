import { commandIdentity } from "@/store/utils/commandIdentity";
import type { SapOperationStatus } from "@/components/SapStatusTag";
/*By Irfan Akbari Vuteq Indonesia - 2026-06-10 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  get,
  post,
  getApiErrorMessage,
  type ApiSuccessEnvelope,
  type PaginatedApiSuccessEnvelope,
} from "@/store/utils/apiService";

// Delivery entity interface
export interface DeliveryEntity {
  SAPIntegration?: SapOperationStatus;
  id: number;
  forecastId: string;
  qty: number;
  palletNumber?: string | null;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  labelDataId: string;
  labelNumber: string;
  releaseNumber: string | null;
}

export interface PalletOption {
  kode: string;
  name?: string;
  partName?: string;
}

// Delivery response interface
export interface DeliveryResponse {
  success: boolean;
  message: string;
  data?: DeliveryEntity;
  error?: string;
}

// Query params interface
export interface DeliveryQuery {
  page?: number;
  limit?: number;
  forecastId?: string;
  createdBy?: string;
  activeReleaseOnly?: boolean;
}

// Create delivery request interface
export interface CreateDeliveryRequest {
  labelNumber: string;
  palletNumber?: string;
}

// Paginated response
// Delivery state
interface DeliveryState {
  data: DeliveryEntity[];
  palletOptions: PalletOption[];
  loadingPallets: boolean;
  loading: boolean;
  creating: boolean;
  error: string | null;
  createResult: DeliveryResponse | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: DeliveryQuery;
}

const initialState: DeliveryState = {
  data: [],
  palletOptions: [],
  loadingPallets: false,
  loading: false,
  creating: false,
  error: null,
  createResult: null,
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  },
  filters: {
    page: 1,
    limit: 50,
    activeReleaseOnly: true,
  },
};

// Fetch all deliveries
export const fetchDelivery = createAsyncThunk<
  PaginatedApiSuccessEnvelope<DeliveryEntity>,
  DeliveryQuery,
  { rejectValue: string }
>("delivery/fetchAll", async (filters: DeliveryQuery, { rejectWithValue }) => {
  try {
    return await get<PaginatedApiSuccessEnvelope<DeliveryEntity>>(
      "/production/delivery",
      {
        params: {
          page: filters.page ?? 1,
          limit: filters.limit ?? 50,
          forecastId: filters.forecastId,
          createdBy: filters.createdBy,
          activeReleaseOnly: filters.activeReleaseOnly,
        },
      },
    );
  } catch (error: unknown) {
    return rejectWithValue(
      getApiErrorMessage(error, "Failed to fetch delivery data"),
    );
  }
});

export const fetchPalletOptions = createAsyncThunk<
  PalletOption[],
  void,
  { rejectValue: string }
>("delivery/fetchPalletOptions", async (_, { rejectWithValue }) => {
  try {
    const response = await get<
      PalletOption[] | ApiSuccessEnvelope<PalletOption[]>
    >("/production/delivery/pallets");
    if (Array.isArray(response)) return response;
    if (
      response &&
      typeof response === "object" &&
      Array.isArray((response as { data?: unknown }).data)
    ) {
      return (response as { data: PalletOption[] }).data;
    }
    return [];
  } catch (error: unknown) {
    return rejectWithValue(
      getApiErrorMessage(error, "Failed to fetch pallet options"),
    );
  }
});

// Create delivery
export const createDelivery = createAsyncThunk<
  DeliveryResponse,
  CreateDeliveryRequest,
  { rejectValue: string }
>(
  "delivery/create",
  async (deliveryData: CreateDeliveryRequest, { rejectWithValue }) => {
    try {
      return await post<DeliveryResponse, CreateDeliveryRequest>(
        "/production/delivery",
        deliveryData,
      );
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to create delivery"),
      );
    }
  },
);

const deliverySlice = createSlice({
  name: "delivery",
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
    clearCreateResult: (state) => {
      state.createResult = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchDelivery.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDelivery.fulfilled, (state, action) => {
        state.loading = false;
        state.data = Array.isArray(action.payload?.data)
          ? action.payload.data
          : [];
        state.pagination = {
          page: action.payload.meta.page,
          limit: action.payload.meta.limit,
          total: action.payload.meta.totalItems,
          totalPages: action.payload.meta.totalPages,
        };
      })
      .addCase(fetchDelivery.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch pallet options
      .addCase(fetchPalletOptions.pending, (state) => {
        state.loadingPallets = true;
      })
      .addCase(fetchPalletOptions.fulfilled, (state, action) => {
        state.loadingPallets = false;
        state.palletOptions = action.payload;
      })
      .addCase(fetchPalletOptions.rejected, (state) => {
        state.loadingPallets = false;
      })
      // Create
      .addCase(createDelivery.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createDelivery.fulfilled, (state, action) => {
        state.creating = false;
        state.createResult = action.payload;
      })
      .addCase(createDelivery.rejected, (state, action) => {
        state.creating = false;
        state.error = action.payload as string;
      });
  },
});

export const { setFilters, resetFilters, clearCreateResult } =
  deliverySlice.actions;
export default deliverySlice.reducer;

export interface CustomerReturnRow {
  Id: string;
  DeliveryId: number;
  Quantity: number;
  ScrappedQuantity: number;
  Reason: string;
  CreatedAt: string;
}
export const fetchCustomerReturns = createAsyncThunk<
  CustomerReturnRow[],
  number,
  { rejectValue: string }
>("delivery/returns", async (id, { rejectWithValue }) => {
  try {
    return (
      await get<ApiSuccessEnvelope<CustomerReturnRow[]>>(
        "/production/delivery/" + id + "/returns",
      )
    ).data;
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error));
  }
});
export const recordCustomerReturn = createAsyncThunk<
  unknown,
  { deliveryId: number; quantity: number; reason: string; returnId?: string },
  { rejectValue: string }
>(
  "delivery/recordReturn",
  async ({ deliveryId, returnId, ...body }, { rejectWithValue }) => {
    try {
      const path =
        "/production/delivery/" +
        deliveryId +
        "/returns" +
        (returnId ? "/" + returnId + "/scrap" : "");
      const command = await commandIdentity("POST", path, body);
      const result = await post<ApiSuccessEnvelope<unknown>>(path, {
        ...body,
        requestId: command.id,
      });
      command.complete();
      return result.data;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  },
);
