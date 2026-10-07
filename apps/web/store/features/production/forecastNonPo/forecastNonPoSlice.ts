/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  get,
  post,
  patch,
  del,
  postFormData,
  getApiErrorMessage,
} from "@/store/utils/apiService";
const base = "/production/forecast-non-po";
export interface NonPoValues {
  partNumber: string;
  deliveryDate: string;
  receivingArea: string;
  deliveryPeriod: number;
  qty: number;
  poNumber?: string | null;
  notes?: string | null;
}
export interface NonPoRecord {
  operationalLocked?: boolean;
  Id: number;
  ReferenceNumber: string;
  PartNumber: string;
  DeliveryDate: string;
  ReceivingArea: string;
  DeliveryPeriod: number;
  Qty: number;
  PoNumber: string | null;
  Notes: string | null;
  PartData?: { PartName: string };
  Demand?: {
    Id: string;
    ProductionReleaseId: string | null;
    ProductionRelease?: { ReleaseNumber: string; Status: string } | null;
  } | null;
}
export interface NonPoQuery {
  page: number;
  limit: number;
  referenceNumber?: string;
  partNumber?: string;
  receivingArea?: string;
  poNumber?: string;
  deliveryDate?: string;
}
export interface ImportPreview {
  rows: {
    rowNumber: number;
    values: NonPoValues;
    errors: string[];
    duplicate: boolean;
  }[];
  total: number;
  alreadyImported: boolean;
}
interface ListResult {
  data: NonPoRecord[];
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
}
export const fetchNonPo = createAsyncThunk<
  ListResult,
  NonPoQuery,
  { rejectValue: string }
>("forecastNonPo/list", async (query, { rejectWithValue }) => {
  try {
    return await get<ListResult>(base, { params: { ...query } });
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error));
  }
});
export const fetchNonPoDetail = createAsyncThunk<
  NonPoRecord,
  number,
  { rejectValue: string }
>("forecastNonPo/detail", async (id, { rejectWithValue }) => {
  try {
    return await get<NonPoRecord>(`${base}/${id}`);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error));
  }
});
export const saveNonPo = createAsyncThunk<
  NonPoRecord,
  {
    id?: number;
    values: NonPoValues;
    requestId: string;
    confirmDuplicates: boolean;
  },
  { rejectValue: string }
>(
  "forecastNonPo/save",
  async ({ id, values, requestId, confirmDuplicates }, { rejectWithValue }) => {
    try {
      return id
        ? await patch<NonPoRecord>(`${base}/${id}`, {
            ...values,
            confirmDuplicates,
          })
        : await post<NonPoRecord>(base, {
            ...values,
            requestId,
            confirmDuplicates,
          });
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  },
);
export const deleteNonPo = createAsyncThunk<
  void,
  number,
  { rejectValue: string }
>("forecastNonPo/delete", async (id, { rejectWithValue }) => {
  try {
    await del(`${base}/${id}`);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error));
  }
});
export const previewNonPo = createAsyncThunk<
  ImportPreview,
  File,
  { rejectValue: string }
>("forecastNonPo/preview", async (file, { rejectWithValue }) => {
  try {
    const body = new FormData();
    body.append("file", file);
    return await postFormData<ImportPreview>(`${base}/import/preview`, body);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error));
  }
});
export const importNonPo = createAsyncThunk<
  { created: number; replayed: boolean },
  { file: File; requestId: string; confirmDuplicates: boolean },
  { rejectValue: string }
>(
  "forecastNonPo/import",
  async ({ file, requestId, confirmDuplicates }, { rejectWithValue }) => {
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("requestId", requestId);
      body.append("confirmDuplicates", String(confirmDuplicates));
      return await postFormData<{ created: number; replayed: boolean }>(
        `${base}/import`,
        body,
      );
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  },
);
export const downloadNonPo = createAsyncThunk<
  void,
  { kind: "template" | "label"; id?: number },
  { rejectValue: string }
>("forecastNonPo/download", async ({ kind, id }, { rejectWithValue }) => {
  try {
    const blob = await get<Blob>(
      kind === "template" ? `${base}/template` : `${base}/${id}/download-tag`,
      { responseType: "blob" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      kind === "template" ? "forecast-non-po.xlsx" : `non-po-${id}.pdf`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error));
  }
});
export const printNonPo = createAsyncThunk<
  void,
  number,
  { rejectValue: string }
>("forecastNonPo/print", async (id, { rejectWithValue }) => {
  try {
    await post(`${base}/${id}/print-tag`, {});
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error));
  }
});
interface State {
  data: NonPoRecord[];
  loading: boolean;
  error: string | null;
  requestId?: string;
  meta: ListResult["meta"];
}
const initialState: State = {
  data: [],
  loading: false,
  error: null,
  meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 },
};
export default createSlice({
  name: "forecastNonPo",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchNonPo.pending, (state, action) => {
      state.loading = true;
      state.error = null;
      state.requestId = action.meta.requestId;
    });
    builder.addCase(fetchNonPo.fulfilled, (state, action) => {
      if (state.requestId !== action.meta.requestId) return;
      state.data = action.payload.data;
      state.meta = action.payload.meta;
      state.loading = false;
    });
    builder.addCase(fetchNonPo.rejected, (state, action) => {
      if (state.requestId !== action.meta.requestId) return;
      state.error = action.payload ?? "Unable to load Non PO forecasts";
      state.loading = false;
    });
  },
}).reducer;
