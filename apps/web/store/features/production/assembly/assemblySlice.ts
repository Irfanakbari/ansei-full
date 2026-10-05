/* By Irfan Akbari Vuteq Indonesia - 2026-09-18 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { withBasePath } from "@/lib/base-path";
import {
  get,
  post,
  getApiErrorMessage,
  type PaginatedApiSuccessEnvelope,
  type ApiSuccessEnvelope,
} from "@/store/utils/apiService";
export interface AssemblySession {
  Id: string;
  ManPowerUid: string;
  ManPowerName: string;
  Status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  StartedAt: string;
  EndedAt: string | null;
  CancelReason: string | null;
  CancelledBy: string | null;
  LabelData: {
    LabelNumber: string;
    FinishGoodId: string;
    QtyThisBox: number;
    ForecastId: string;
    ProductionReleaseId: string | null;
    ProductionRelease: { ReleaseNumber: string } | null;
    PartData: { PartName: string };
  };
}
export interface OperatorAssembly {
  active: boolean;
  session: AssemblySession | null;
  serverTime: string;
}
export interface AssemblyProgress {
  waitingShopping: number;
  ready: number;
  inProgress: number;
  completed: number;
  notRequired: number;
}
export interface AssemblyQuery {
  page?: number;
  limit?: number;
  status?: string;
  labelNumber?: string;
  manPowerNik?: string;
  productionReleaseId?: string;
  activeReleaseOnly?: boolean;
}
async function displayRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(withBasePath(`/api/display/assembly/${path}`), {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const result = (await response.json()) as ApiSuccessEnvelope<T>;
  if (!response.ok)
    throw new Error(
      typeof result.message === "string"
        ? result.message
        : "Assembly request failed",
    );
  return result.data;
}
export const fetchOperatorAssembly = createAsyncThunk<
  OperatorAssembly,
  string,
  { rejectValue: string }
>("assembly/operator", async (nik, { rejectWithValue }) => {
  try {
    return await displayRequest<OperatorAssembly>(
      `operator?manPowerNik=${encodeURIComponent(nik)}`,
    );
  } catch (error) {
    return rejectWithValue(
      getApiErrorMessage(error, "Cannot refresh assembly. Check connection."),
    );
  }
});
export const startAssembly = createAsyncThunk<
  AssemblySession,
  { labelNumber: string; manPowerNik: string; requestId: string },
  { rejectValue: string }
>("assembly/start", async (body, { rejectWithValue }) => {
  try {
    return await displayRequest<AssemblySession>("start", body);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error));
  }
});
export const completeAssembly = createAsyncThunk<
  AssemblySession,
  { id: string; manPowerNik: string; requestId: string },
  { rejectValue: string }
>("assembly/complete", async ({ id, ...body }, { rejectWithValue }) => {
  try {
    return await displayRequest<AssemblySession>(
      `${encodeURIComponent(id)}/complete`,
      body,
    );
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error));
  }
});
export const fetchAssemblySessions = createAsyncThunk<
  PaginatedApiSuccessEnvelope<AssemblySession>,
  AssemblyQuery,
  { rejectValue: string }
>("assembly/list", async (query, { rejectWithValue }) => {
  try {
    return await get<PaginatedApiSuccessEnvelope<AssemblySession>>(
      "/production/assembly/sessions",
      { params: { ...query } },
    );
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error));
  }
});
export const fetchAssemblyProgress = createAsyncThunk<
  AssemblyProgress,
  Pick<AssemblyQuery, "productionReleaseId" | "labelNumber">,
  { rejectValue: string }
>("assembly/progress", async (query, { rejectWithValue }) => {
  try {
    return (
      await get<ApiSuccessEnvelope<AssemblyProgress>>(
        "/production/assembly/progress",
        { params: { ...query } },
      )
    ).data;
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error));
  }
});
export const cancelAssembly = createAsyncThunk<
  AssemblySession,
  { id: string; reason: string },
  { rejectValue: string }
>("assembly/cancel", async ({ id, reason }, { rejectWithValue }) => {
  try {
    return (
      await post<ApiSuccessEnvelope<AssemblySession>, { reason: string }>(
        `/production/assembly/${encodeURIComponent(id)}/cancel`,
        { reason },
      )
    ).data;
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error));
  }
});
const slice = createSlice({
  name: "assembly",
  initialState: {
    sessions: [] as AssemblySession[],
    total: 0,
    loading: false,
    error: null as string | null,
    requestId: "",
  },
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchAssemblySessions.pending, (state, action) => {
      state.loading = true;
      state.error = null;
      state.requestId = action.meta.requestId;
    });
    builder.addCase(fetchAssemblySessions.fulfilled, (state, action) => {
      if (state.requestId !== action.meta.requestId) return;
      state.loading = false;
      state.sessions = action.payload.data;
      state.total = action.payload.meta.totalItems;
    });
    builder.addCase(fetchAssemblySessions.rejected, (state, action) => {
      if (state.requestId !== action.meta.requestId) return;
      state.loading = false;
      state.error = action.payload ?? "Cannot load assembly sessions";
    });
  },
});
export default slice.reducer;

export interface AssemblyCreateOptions {
  labels: AssemblySession["LabelData"][];
  manpower: { Nik: string; Name: string }[];
}
export const fetchAssemblyCreateOptions = createAsyncThunk<
  AssemblyCreateOptions,
  string,
  { rejectValue: string }
>("assembly/createOptions", async (labelNumber, { rejectWithValue }) => {
  try {
    return (
      await get<ApiSuccessEnvelope<AssemblyCreateOptions>>(
        "/production/assembly/create-options",
        { params: { labelNumber } },
      )
    ).data;
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error));
  }
});
export const startInternalAssembly = createAsyncThunk<
  AssemblySession,
  { labelNumber: string; manPowerNik: string; requestId: string },
  { rejectValue: string }
>("assembly/startInternal", async (body, { rejectWithValue }) => {
  try {
    return (
      await post<ApiSuccessEnvelope<AssemblySession>, typeof body>(
        "/production/assembly/start",
        body,
      )
    ).data;
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error));
  }
});

export const completeInternalAssembly = createAsyncThunk<
  AssemblySession,
  { id: string; requestId: string },
  { rejectValue: string }
>("assembly/completeInternal", async ({ id, ...body }, { rejectWithValue }) => {
  try {
    return (
      await post<ApiSuccessEnvelope<AssemblySession>, typeof body>(
        "/production/assembly/" + encodeURIComponent(id) + "/complete",
        body,
      )
    ).data;
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error));
  }
});
