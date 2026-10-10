/*By Irfan Akbari Vuteq Indonesia - 2026-06-07 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  get,
  type ApiSuccessEnvelope,
  getApiErrorMessage,
  type PaginatedApiSuccessEnvelope,
} from "../../utils/apiService";

export interface FGData {
  Id: number;
  PartNumber: string;
  PartName: string;
}

export interface MaterialData {
  Id: number;
  PartNumber: string;
  PartName: string;
}

export interface BOMEntity {
  Id: number;
  MaterialId: number;
  FinishGoodId: string;
  Qty: number;
  FGData: FGData;
  MaterialData: MaterialData;
}

export interface BOMGrouped {
  FinishGoodId: string;
  FGData: FGData;
  materials: BOMEntity[];
}

interface BOMState {
  data: BOMEntity[];
  loading: boolean;
  error: string | null;
  query: BOMQuery;
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}
export interface BOMQuery {
  page?: number;
  limit?: number;
  search?: string;
}

const initialState: BOMState = {
  data: [],
  loading: false,
  error: null,
  query: { page: 1, limit: 50 },
  pagination: { page: 1, limit: 50, totalItems: 0, totalPages: 0 },
};

export const exportBomExcel = createAsyncThunk(
  "bom/exportExcel",
  async (query: { search?: string } | undefined, { rejectWithValue }) => {
    try {
      const { downloadWithAutoFilename } =
        await import("../../utils/apiService");
      await downloadWithAutoFilename("/master/bill-of-materials/export", {
        params: {
          search: query?.search,
        },
      });
      return true;
    } catch (error: unknown) {
      const { getApiErrorMessage } = await import("../../utils/apiService");
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to export bill of materials"),
      );
    }
  },
);

export const fetchBOM = createAsyncThunk<
  PaginatedApiSuccessEnvelope<BOMEntity>,
  BOMQuery | undefined,
  { rejectValue: string }
>("bom/fetchAll", async (query = {}, { rejectWithValue }) => {
  try {
    return await get<PaginatedApiSuccessEnvelope<BOMEntity>>(
      "/master/bill-of-materials",
      {
        params: { page: query.page, limit: query.limit, search: query.search },
      },
    );
  } catch (error: unknown) {
    return rejectWithValue(
      getApiErrorMessage(error, "Failed to fetch BOM data"),
    );
  }
});

const bomSlice = createSlice({
  name: "bom",
  initialState,
  reducers: {
    setBOMQuery: (state, action: { payload: BOMQuery }) => {
      state.query = { ...state.query, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBOM.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBOM.fulfilled, (state, action) => {
        state.loading = false;
        state.data = Array.isArray(action.payload?.data)
          ? action.payload.data
          : [];
        state.pagination = action.payload.meta ?? initialState.pagination;
      })
      .addCase(fetchBOM.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setBOMQuery } = bomSlice.actions;
export default bomSlice.reducer;

export interface SapBomPreview {
  finishGoodId: number;
  partNumber: string;
  sapPartNumber: string | null;
  status: "FOUND" | "NOT_FOUND" | "UNKNOWN" | "DISABLED" | "UNMAPPED";
  checkedAt: string | null;
  stale: boolean;
  bom: {
    TreeCode: string;
    Quantity: number;
    ProductDescription: string | null;
    ProductTreeLines: {
      LineNumber: number;
      ItemCode: string;
      Quantity: number;
      Warehouse: string | null;
      WarehouseName: string | null;
      ItemType: string | null;
    }[];
  } | null;
}

export const fetchSapBom = createAsyncThunk<
  SapBomPreview,
  number,
  { rejectValue: string }
>("bom/fetchSap", async (finishGoodId, { rejectWithValue, signal }) => {
  try {
    const response = await get<ApiSuccessEnvelope<SapBomPreview>>(
      `/master/bill-of-materials/sap/${finishGoodId}`,
      { signal },
    );
    return response.data;
  } catch (error: unknown) {
    return rejectWithValue(getApiErrorMessage(error, "Failed to load SAP BOM"));
  }
});
