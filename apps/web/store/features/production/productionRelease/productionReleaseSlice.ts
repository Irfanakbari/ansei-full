/*By Irfan Akbari Vuteq Indonesia - 2026-06-08 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  get,
  getApiErrorMessage,
  post,
  type ApiSuccessEnvelope,
} from "@/store/utils/apiService";
import { fetchWithAuth } from "@/store/utils/fetchWithAuth";

import {
  parseOrderCandidateIds,
  type OrderCandidateIds,
} from "./orderCandidateIds";

// Forecast item interface
export interface ForecastItem {
  SourceType?: "PO" | "NON_PO";
  PoId: string;
  PoNumber?: string;
  FinishGoodId: string;
  Qty: number;
  DeliveryDate: string;
  DeliveryPeriod: number;
  ProductionReleaseId?: string | null;
  PartData: {
    PartNumber: string;
    PartName: string;
  };
  Shopping: {
    QtyPick: number;
  }[];
}

export interface OrderCandidateQuery {
  sourceType?: "PO" | "NON_PO";
  id?: string;
  mode?: "tag" | "untag";
  page?: number;
  limit?: number;
  search?: string;
  poNumber?: string;
  partNumber?: string;
  deliveryDate?: string;
}

export type OrderCandidate = Pick<
  ForecastItem,
  | "SourceType"
  | "PoId"
  | "Qty"
  | "FinishGoodId"
  | "DeliveryDate"
  | "DeliveryPeriod"
  | "ProductionReleaseId"
  | "PartData"
>;
export interface PaginatedOrderCandidates {
  data: OrderCandidate[];
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
}

export const fetchOrderCandidates = createAsyncThunk<
  PaginatedOrderCandidates,
  OrderCandidateQuery,
  { rejectValue: string }
>(
  "productionRelease/orderCandidates",
  async ({ id, ...params }, { rejectWithValue }) => {
    try {
      return await get<PaginatedOrderCandidates>(
        id
          ? `/production/production-release/${encodeURIComponent(id)}/forecast-candidates`
          : "/production/production-release/order-candidates",
        { params },
      );
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to load production orders"),
      );
    }
  },
);

export const fetchOrderCandidateIds = createAsyncThunk<
  OrderCandidateIds,
  OrderCandidateQuery,
  { rejectValue: string }
>(
  "productionRelease/orderCandidateIds",
  async (
    { id, sourceType, mode, search, poNumber, partNumber, deliveryDate },
    { rejectWithValue },
  ) => {
    try {
      const response = await get<unknown>(
        id
          ? `/production/production-release/${encodeURIComponent(id)}/forecast-candidate-ids`
          : "/production/production-release/order-candidate-ids",
        {
          params: {
            sourceType,
            mode,
            search,
            poNumber,
            partNumber,
            deliveryDate,
          },
        },
      );
      return parseOrderCandidateIds(response);
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to select production orders"),
      );
    }
  },
);

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

export interface ProgressAssembly {
  required: boolean;
  total: number;
  completed: number;
  pending: number;
  percentage: number;
}

export interface ProgressOverall {
  percentage: number;
  stageCount: number;
}

// Attachment interface (from Prisma deliveryAttachment)
export interface ProductionAttachment {
  Id: number;
  ProductionReleaseId: string;
  FileName: string;
  FileSize: number | null;
  MimeType: string | null;
  CreatedAt: string;
  CreatedBy: string | null;
  CreatedByName?: string;
  UpdatedAt: string;
  UpdatedBy?: string | null;
  UpdatedByName?: string;
}

export type ProductionReleaseStatus =
  "DRAFT" | "RELEASED" | "COMPLETED" | "CANCELLED";

// Production release entity interface
export interface ProductionReleaseEntity {
  SourceType: "PO" | "NON_PO";
  Id: string;
  ReleaseNumber: string;
  PlanDate: string;
  Status: ProductionReleaseStatus;
  Notes: string | null;
  IsNoAttachment: boolean;
  TotalTargetQty: number;
  TotalGoodQty: number;
  TotalNgQty: number;
  TotalProductionMinutes: number | null;
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
  progressAssembly?: ProgressAssembly;
  progressOverall?: ProgressOverall;
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
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  forecastCandidates: ForecastItem[];
  forecastCandidatesLoading: boolean;
  forecastCandidatesPagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
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
  forecastCandidates: [],
  forecastCandidatesLoading: false,
  forecastCandidatesPagination: {
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0,
  },
};

export const fetchProductionReleaseForecastCandidates = createAsyncThunk<
  PaginatedForecastCandidates,
  {
    id: string;
    mode: "tag" | "untag";
    page: number;
    limit: number;
    search?: string;
    poNumber?: string;
    partNumber?: string;
    deliveryDate?: string;
  },
  { rejectValue: string }
>(
  "productionRelease/fetchForecastCandidates",
  async ({ id, ...params }, { rejectWithValue }) => {
    try {
      return await get<PaginatedForecastCandidates>(
        `/production/production-release/${id}/forecast-candidates`,
        { params },
      );
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to fetch forecast candidates"),
      );
    }
  },
);

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

interface PaginatedForecastCandidates {
  data: ForecastItem[];
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
}

// Fetch all production releases
export const fetchProductionRelease = createAsyncThunk<
  ApiSuccessEnvelope<PaginatedProductionRelease>,
  ProductionReleaseQuery | undefined,
  { rejectValue: string }
>("productionRelease/fetchAll", async (query = {}, { rejectWithValue }) => {
  try {
    return await get<ApiSuccessEnvelope<PaginatedProductionRelease>>(
      "/production/production-release",
      {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search,
          status: query.status,
        },
      },
    );
  } catch (error: unknown) {
    return rejectWithValue(
      getApiErrorMessage(error, "Failed to fetch production release data"),
    );
  }
});

// Fetch production release by ID
export const fetchProductionReleaseById = createAsyncThunk(
  "productionRelease/fetchById",
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetchWithAuth(
        `/api/production/production-release/${id}`,
      );
      const data = await response.json();
      if (!response.ok)
        return rejectWithValue(
          data.message || "Failed to fetch production release detail",
        );
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export interface CreateProductionReleasePayload {
  sourceType?: "PO" | "NON_PO";
  releaseNumber?: string;
  planDate: string;
  notes?: string;
  forecastIds?: string[];
  demandIds?: string[];
  isNoAttachment?: boolean;
}

// Create production release
export const createProductionRelease = createAsyncThunk<
  ProductionReleaseEntity,
  CreateProductionReleasePayload,
  { rejectValue: string }
>("productionRelease/create", async (releaseData, { rejectWithValue }) => {
  try {
    const response = await fetchWithAuth("/api/production/production-release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(releaseData),
    });
    const data = await response.json();
    if (!response.ok)
      return rejectWithValue(
        data.message || "Failed to create production release",
      );
    return data;
  } catch (error: unknown) {
    return rejectWithValue(
      getApiErrorMessage(error, "Failed to create production release"),
    );
  }
});

export interface UpdateProductionReleasePayload {
  totalProductionMinutes?: number;
  status?: "DRAFT" | "RELEASED" | "COMPLETED" | "CANCELLED";
  notes?: string;
  forecastIds?: string[];
  demandIds?: string[];
  isNoAttachment?: boolean;
}

export interface AmendProductionReleasePayload {
  id: string;
  forecastIds?: string[];
  demandIds?: string[];
  reason: string;
}

export const cancelProductionRelease = createAsyncThunk<
  ProductionReleaseEntity,
  { id: string; reason: string },
  { rejectValue: string }
>("productionRelease/cancel", async ({ id, reason }, { rejectWithValue }) => {
  try {
    return await post<ProductionReleaseEntity, { reason: string }>(
      `/production/production-release/${id}/cancel`,
      { reason },
    );
  } catch (error: unknown) {
    return rejectWithValue(
      getApiErrorMessage(error, "Failed to cancel production release"),
    );
  }
});

export const tagProductionReleaseForecasts = createAsyncThunk<
  ProductionReleaseEntity,
  AmendProductionReleasePayload,
  { rejectValue: string }
>(
  "productionRelease/tagForecasts",
  async ({ id, forecastIds, demandIds, reason }, { rejectWithValue }) => {
    try {
      return await post<
        ProductionReleaseEntity,
        { forecastIds?: string[]; demandIds?: string[]; reason: string }
      >(`/production/production-release/${id}/forecasts/tag`, {
        forecastIds,
        demandIds,
        reason,
      });
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to tag forecasts"),
      );
    }
  },
);

export const untagProductionReleaseForecasts = createAsyncThunk<
  ProductionReleaseEntity,
  AmendProductionReleasePayload,
  { rejectValue: string }
>(
  "productionRelease/untagForecasts",
  async ({ id, forecastIds, demandIds, reason }, { rejectWithValue }) => {
    try {
      return await post<
        ProductionReleaseEntity,
        { forecastIds?: string[]; demandIds?: string[]; reason: string }
      >(`/production/production-release/${id}/forecasts/untag`, {
        forecastIds,
        demandIds,
        reason,
      });
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to untag forecasts"),
      );
    }
  },
);

// Update production release
export const updateProductionRelease = createAsyncThunk<
  unknown,
  { id: string; data: UpdateProductionReleasePayload },
  { rejectValue: string }
>(
  "productionRelease/update",
  async ({ id, data: updateData }, { rejectWithValue }) => {
    try {
      const response = await fetchWithAuth(
        `/api/production/production-release/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        },
      );
      const data: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "message" in data &&
          typeof data.message === "string"
            ? data.message
            : "Failed to update production release";
        return rejectWithValue(message);
      }
      return data;
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to update production release"),
      );
    }
  },
);

// Delete production release
export const deleteProductionRelease = createAsyncThunk(
  "productionRelease/delete",
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetchWithAuth(
        `/api/production/production-release/${id}`,
        {
          method: "DELETE",
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        return rejectWithValue(
          data.message || "Failed to delete production release",
        );
      return id;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

// Fetch attachments for production release
export const fetchAttachments = createAsyncThunk(
  "productionRelease/fetchAttachments",
  async (productionReleaseId: string, { rejectWithValue }) => {
    try {
      const response = await fetchWithAuth(
        `/api/production/production-release/${productionReleaseId}/attachments`,
      );
      const data = await response.json();
      if (!response.ok)
        return rejectWithValue(data.message || "Gagal mengambil data lampiran");
      return data.data as ProductionAttachment[];
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

// Upload attachment for production release
export const uploadAttachments = createAsyncThunk(
  "productionRelease/uploadAttachment",
  async (
    {
      productionReleaseId,
      files,
    }: {
      productionReleaseId: string;
      files: File[];
    },
    { rejectWithValue },
  ) => {
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const response = await fetchWithAuth(
        `/api/production/production-release/${productionReleaseId}/attachments`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();
      if (!response.ok)
        return rejectWithValue(data.message || "Gagal upload lampiran");
      return data.data as ProductionAttachment[];
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const replaceAttachment = createAsyncThunk(
  "productionRelease/replaceAttachment",
  async (
    {
      productionReleaseId,
      attachmentId,
      file,
    }: { productionReleaseId: string; attachmentId: number; file: File },
    { rejectWithValue },
  ) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetchWithAuth(
        `/api/production/production-release/${productionReleaseId}/attachments/${attachmentId}`,
        { method: "PATCH", body: formData },
      );
      const data = await response.json();
      if (!response.ok)
        return rejectWithValue(data.message || "Failed to replace attachment");
      return data.data as ProductionAttachment;
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to replace attachment"),
      );
    }
  },
);

export const downloadAttachment = createAsyncThunk(
  "productionRelease/downloadAttachment",
  async (
    {
      productionReleaseId,
      attachment,
    }: { productionReleaseId: string; attachment: ProductionAttachment },
    { rejectWithValue },
  ) => {
    try {
      const response = await fetchWithAuth(
        `/api/production/production-release/${productionReleaseId}/attachments/${attachment.Id}/download`,
      );
      if (!response.ok) throw new Error("Failed to download attachment");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.FileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to download attachment"),
      );
    }
  },
);

// Delete attachment
export const deleteAttachment = createAsyncThunk(
  "productionRelease/deleteAttachment",
  async (
    {
      productionReleaseId,
      attachmentId,
    }: { productionReleaseId: string; attachmentId: number },
    { rejectWithValue },
  ) => {
    try {
      const response = await fetchWithAuth(
        `/api/production/production-release/${productionReleaseId}/attachments/${attachmentId}`,
        {
          method: "DELETE",
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        return rejectWithValue(data.message || "Gagal hapus lampiran");
      return attachmentId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

// Clear detail
export const clearProductionReleaseDetail = createAsyncThunk(
  "productionRelease/clearDetail",
  async () => {},
);

const productionReleaseSlice = createSlice({
  name: "productionRelease",
  initialState,
  reducers: {
    clearDetail: (state) => {
      state.detail = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchProductionRelease.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
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
      .addCase(fetchProductionReleaseById.pending, (state) => {
        state.detailLoading = true;
        state.error = null;
      })
      .addCase(fetchProductionReleaseById.fulfilled, (state, action) => {
        state.detailLoading = false;
        state.detail = (action.payload as any)?.data || action.payload;
      })
      .addCase(fetchProductionReleaseById.rejected, (state, action) => {
        state.detailLoading = false;
        state.error = action.payload as string;
      })
      // Create
      .addCase(createProductionRelease.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProductionRelease.fulfilled, (state, action) => {
        state.loading = false;
        const created = (action.payload as any)?.data || action.payload;
        if (created && typeof created === "object" && created.Id) {
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
          const index = state.data.findIndex((item) => item.Id === updated.Id);
          if (index !== -1) {
            state.data[index] = updated;
          }
        }
      })
      // Delete
      .addCase(deleteProductionRelease.fulfilled, (state, action) => {
        state.data = state.data.filter((item) => item.Id !== action.payload);
      })
      // Fetch attachments
      .addCase(fetchAttachments.pending, (state) => {
        state.attachmentLoading = true;
      })
      .addCase(fetchAttachments.fulfilled, (state, action) => {
        state.attachmentLoading = false;
        state.attachments = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchAttachments.rejected, (state, action) => {
        state.attachmentLoading = false;
        state.error = action.payload as string;
      })
      // Upload attachment
      .addCase(uploadAttachments.pending, (state) => {
        state.attachmentLoading = true;
      })
      .addCase(uploadAttachments.fulfilled, (state, action) => {
        state.attachmentLoading = false;
        state.attachments.unshift(...action.payload);
      })
      .addCase(uploadAttachments.rejected, (state, action) => {
        state.attachmentLoading = false;
        state.error = action.payload as string;
      })
      .addCase(replaceAttachment.fulfilled, (state, action) => {
        const index = state.attachments.findIndex(
          (item) => item.Id === action.payload.Id,
        );
        if (index >= 0) state.attachments[index] = action.payload;
      })
      // Delete attachment
      .addCase(deleteAttachment.fulfilled, (state, action) => {
        state.attachments = state.attachments.filter(
          (item) => item.Id !== action.payload,
        );
      })
      .addCase(fetchProductionReleaseForecastCandidates.pending, (state) => {
        state.forecastCandidatesLoading = true;
      })
      .addCase(
        fetchProductionReleaseForecastCandidates.fulfilled,
        (state, action) => {
          state.forecastCandidatesLoading = false;
          state.forecastCandidates = action.payload.data;
          state.forecastCandidatesPagination = action.payload.meta;
        },
      )
      .addCase(
        fetchProductionReleaseForecastCandidates.rejected,
        (state, action) => {
          state.forecastCandidatesLoading = false;
          state.error = action.payload ?? "Failed to fetch forecast candidates";
        },
      )
      // Clear detail
      .addCase(clearProductionReleaseDetail.fulfilled, (state) => {
        state.detail = null;
      });
  },
});

export const { clearDetail } = productionReleaseSlice.actions;
export default productionReleaseSlice.reducer;
