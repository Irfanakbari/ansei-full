/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  get,
  post,
  getApiErrorMessage,
  type ApiSuccessEnvelope,
  type PaginatedApiSuccessEnvelope,
} from "@/store/utils/apiService";
import { commandIdentity } from "@/store/utils/commandIdentity";
export interface SapOverview {
  settings: { enabled: boolean; projectCode: string; costCenter: string };
  redis: {
    available: boolean;
    aofEnabled: boolean | null;
    aofWriteHealthy: boolean | null;
  };
  workerHealthy: boolean;
  company: string;
  warehouse: string;
  captureEnabled: boolean;
  postingEnabled: boolean;
  tlsValidation: boolean;
  allowedFinishGoods: string[];
  allowedMaterials: string[];
  counts: Record<string, number>;
  oldestPendingAt: string | null;
  lastPostedAt: string | null;
  session: { active: boolean; expiresAt: string | null };
  connection: {
    Connected: boolean;
    CheckedAt: string | null;
    RefreshedAt: string | null;
    WorkerAt: string | null;
  } | null;
}
export interface SapTransactionRow {
  id: string;
  type: string;
  status: string;
  itemCode: string | null;
  quantity: number | null;
  referenceId: string | null;
  demandId: string | null;
  attempts: number;
  errorCode: string | null;
  error: string | null;
  documentEntry: number | null;
  documentNumber: number | null;
  createdAt: string;
  postedAt: string | null;
}
export interface SapStockRow {
  itemCode: string;
  names: string[];
  partNumbers: string[];
  warehouse: number;
  rack: number;
  mes: number;
  sap: number | null;
  awaitingBackflush: number;
  pendingEffect: number;
  expectedSap: number;
  unexplained: number | null;
  status: string;
  observedAt: string | null;
  cutoff: string;
}
export interface SapMappingRow {
  demandId: string;
  partNumber: string;
  itemCode: string;
  name: string;
  warehouse: string;
  captured: boolean;
  mapping: {
    SalesOrderEntry: number | null;
    SalesOrderLine: number | null;
    CardCode: string;
    AutoCreate: boolean;
  } | null;
}
export interface SapQuery {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  referenceId?: string;
}
export const fetchSapOverview = createAsyncThunk<
  SapOverview,
  void,
  { rejectValue: string }
>("sapConnection/overview", async (_, { rejectWithValue }) => {
  try {
    return (
      await get<ApiSuccessEnvelope<SapOverview>>("/sap-connection/overview")
    ).data;
  } catch (error) {
    return rejectWithValue(
      getApiErrorMessage(error, "Unable to load SAP health"),
    );
  }
});
export const saveSapSettings = createAsyncThunk<
  unknown,
  { enabled: boolean; projectCode: string; costCenter: string; reason: string },
  { rejectValue: string }
>("sapConnection/settings", async (body, { rejectWithValue }) => {
  try {
    const path = "/sap-connection/settings";
    const identity = await commandIdentity("POST", path, body);
    const result = await post<ApiSuccessEnvelope<unknown>>(path, {
      ...body,
      requestId: identity.id,
    });
    identity.complete();
    return result.data;
  } catch (error) {
    return rejectWithValue(
      getApiErrorMessage(error, "Unable to save SAP settings"),
    );
  }
});
function listThunk<T>(resource: string) {
  return createAsyncThunk<
    PaginatedApiSuccessEnvelope<T>,
    SapQuery,
    { rejectValue: string }
  >(`sapConnection/${resource}`, async (query, { rejectWithValue }) => {
    try {
      return await get<PaginatedApiSuccessEnvelope<T>>(
        `/sap-connection/${resource}`,
        { params: { ...query } },
      );
    } catch (error) {
      return rejectWithValue(
        getApiErrorMessage(error, "Unable to load SAP integration data"),
      );
    }
  });
}
export const fetchSapTransactions =
  listThunk<SapTransactionRow>("transactions");
export const fetchSapStock = listThunk<SapStockRow>("stock");
export const fetchSapMappings = listThunk<SapMappingRow>("mappings");
export const sapAction = createAsyncThunk<
  unknown,
  {
    action:
      | "check"
      | "refresh-stock"
      | "retry"
      | "cancel-counting"
      | "reconcile"
      | "mappings"
      | "automatic-sales";
    id?: string;
    body?: Record<string, unknown>;
  },
  { rejectValue: string }
>(
  "sapConnection/action",
  async ({ action, id, body = {} }, { rejectWithValue }) => {
    try {
      const path =
        action === "retry" ||
        action === "cancel-counting" ||
        action === "reconcile"
          ? `/sap-connection/transactions/${encodeURIComponent(id ?? "")}/${action}`
          : `/sap-connection/${action}`;
      if (
        action === "retry" ||
        action === "cancel-counting" ||
        action === "mappings"
      ) {
        const identity = await commandIdentity("POST", path, body);
        const result = await post<ApiSuccessEnvelope<unknown>>(path, {
          ...body,
          requestId: identity.id,
        });
        identity.complete();
        return result.data;
      }
      return (await post<ApiSuccessEnvelope<unknown>>(path, {})).data;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, "SAP operation failed"));
    }
  },
);
export interface SapDetail {
  id: string;
  status: string;
  source: string;
  error: string | null;
  documentEntry?: number;
  documentNumber?: number;
  effects?: { itemCode: string; quantity: number }[];
  audit: { Id: string; Action: string; CreatedAt: string }[];
}
export const fetchSapDetail = createAsyncThunk<
  SapDetail,
  string,
  { rejectValue: string }
>("sapConnection/detail", async (id, { rejectWithValue }) => {
  try {
    return (
      await get<ApiSuccessEnvelope<SapDetail>>(
        `/sap-connection/transactions/${encodeURIComponent(id)}`,
      )
    ).data;
  } catch (error) {
    return rejectWithValue(
      getApiErrorMessage(error, "Unable to load transaction detail"),
    );
  }
});
const initialState: {
  overview: SapOverview | null;
  loading: boolean;
  error: string | null;
  requestId?: string;
} = { overview: null, loading: false, error: null };
const slice = createSlice({
  name: "sapConnection",
  initialState,
  reducers: {},
  extraReducers: (builder) =>
    builder
      .addCase(fetchSapOverview.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.requestId = action.meta.requestId;
      })
      .addCase(fetchSapOverview.fulfilled, (state, action) => {
        if (state.requestId === action.meta.requestId) {
          state.loading = false;
          state.overview = action.payload;
        }
      })
      .addCase(fetchSapOverview.rejected, (state, action) => {
        if (state.requestId === action.meta.requestId) {
          state.loading = false;
          state.error = action.payload ?? "Unable to load SAP health";
        }
      }),
});
export default slice.reducer;

export interface SapExternalRow {
  Resource: string;
  DocumentEntry: number;
  DocumentNumber: number;
  Warehouse: string;
  ObservedAt: string;
}
export const fetchSapExternal = listThunk<SapExternalRow>("external-documents");
