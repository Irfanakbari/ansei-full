/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  get,
  post,
  patch,
  getApiErrorMessage,
  type ApiSuccessEnvelope,
} from "@/store/utils/apiService";
import type {
  BomRevision,
  BomSnapshot,
  CreateNgInput,
  NgCase,
  Page,
  TraceData,
  TraceEvent,
  TraceSearchRow,
} from "./types";
export type ListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  active?: string;
  finishGoodId?: number;
  forecastId?: string;
};
function queryString(q: ListQuery) {
  return new URLSearchParams(
    Object.entries(q)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}
function reader<T, A>(name: string, path: (arg: A) => string) {
  return createAsyncThunk<T, A, { rejectValue: string }>(
    `phaseOne/${name}`,
    async (arg, { rejectWithValue }) => {
      try {
        const response = await get<ApiSuccessEnvelope<T>>(path(arg));
        return response.data;
      } catch (error) {
        return rejectWithValue(getApiErrorMessage(error));
      }
    },
  );
}
// Pagination metadata sits alongside envelope.data, not inside it.
function listing<T>(name: string, path: string) {
  return createAsyncThunk<Page<T>, ListQuery, { rejectValue: string }>(
    `phaseOne/${name}`,
    async (q, { rejectWithValue }) => {
      try {
        const response = await get<
          ApiSuccessEnvelope<T[]> & { meta: Page<T>["meta"] }
        >(`${path}?${queryString(q)}`);
        return { data: response.data, meta: response.meta };
      } catch (error) {
        return rejectWithValue(getApiErrorMessage(error));
      }
    },
  );
}
export const fetchRevisions = listing<BomRevision>(
  "revisions",
  "/master/bom-revisions",
);
export const fetchRevision = reader<BomRevision, string>(
  "revision",
  (id) => `/master/bom-revisions/${id}`,
);
export const fetchBomComparison = reader<
  {
    materialId: number;
    partNumber: string;
    before: number;
    after: number;
    change: string;
  }[],
  { id: string; baseId?: string }
>(
  "comparison",
  ({ id, baseId }) =>
    `/master/bom-revisions/${id}/compare${baseId ? `?baseId=${baseId}` : ""}`,
);
export const fetchBomSnapshots = reader<BomSnapshot[], string>(
  "snapshots",
  (id) => `/production/production-release/${id}/bom-snapshots`,
);
export const fetchNgCases = listing<NgCase>(
  "ngCases",
  "/production/material-ng-cases",
);
export const fetchNgCase = reader<NgCase, string>(
  "ngCase",
  (id) => `/production/material-ng-cases/${id}`,
);
export const searchNgOrders = listing<TraceSearchRow>(
  "ngOrders",
  "/production/material-ng-cases/candidates",
);
export const searchTrace = listing<TraceSearchRow>(
  "search",
  "/traceability/search",
);
export const fetchTrace = reader<TraceData, string>(
  "trace",
  (id) => `/traceability/forecasts/${encodeURIComponent(id)}`,
);
export const fetchTraceEvents = createAsyncThunk<
  Page<TraceEvent>,
  { poId: string; page: number },
  { rejectValue: string }
>("phaseOne/events", async ({ poId, page }, { rejectWithValue }) => {
  try {
    const r = await get<
      ApiSuccessEnvelope<TraceEvent[]> & { meta: Page<TraceEvent>["meta"] }
    >(
      `/traceability/forecasts/${encodeURIComponent(poId)}/events?page=${page}`,
    );
    return { data: r.data, meta: r.meta };
  } catch (e) {
    return rejectWithValue(getApiErrorMessage(e));
  }
});
export const createRevision = createAsyncThunk<
  BomRevision,
  {
    finishGoodId: number;
    reason: string;
    copyFromId?: string;
    importLegacy?: boolean;
    lines?: { materialId: number; qty: number }[];
  },
  { rejectValue: string }
>("phaseOne/createRevision", async (body, { rejectWithValue }) => {
  try {
    return (
      await post<ApiSuccessEnvelope<BomRevision>>("/master/bom-revisions", body)
    ).data;
  } catch (e) {
    return rejectWithValue(getApiErrorMessage(e));
  }
});
export const changeRevision = createAsyncThunk<
  BomRevision,
  {
    id: string;
    action: "edit" | "submit" | "approve" | "reject" | "cancel";
    expectedVersion: number;
    expectedActiveRevisionId?: string | null;
    reason?: string;
    lines?: { materialId: number; qty: number }[];
  },
  { rejectValue: string }
>(
  "phaseOne/changeRevision",
  async ({ id, action, ...body }, { rejectWithValue }) => {
    try {
      return (
        action === "edit"
          ? await patch<ApiSuccessEnvelope<BomRevision>>(
              `/master/bom-revisions/${id}`,
              body,
            )
          : await post<ApiSuccessEnvelope<BomRevision>>(
              `/master/bom-revisions/${id}/${action}`,
              body,
            )
      ).data;
    } catch (e) {
      return rejectWithValue(getApiErrorMessage(e));
    }
  },
);
export const createNgCase = createAsyncThunk<
  NgCase,
  CreateNgInput,
  { rejectValue: string }
>("phaseOne/createNg", async (body, { rejectWithValue }) => {
  try {
    return (
      await post<ApiSuccessEnvelope<NgCase>>(
        "/production/material-ng-cases",
        body,
      )
    ).data;
  } catch (e) {
    return rejectWithValue(getApiErrorMessage(e));
  }
});
export const issueNg = createAsyncThunk<
  NgCase,
  { id: string; requestId: string; lines: { detailId: number; qty: number }[] },
  { rejectValue: string }
>("phaseOne/issueNg", async ({ id, ...body }, { rejectWithValue }) => {
  try {
    return (
      await post<ApiSuccessEnvelope<NgCase>>(
        `/production/material-ng-cases/${id}/issue`,
        body,
      )
    ).data;
  } catch (e) {
    return rejectWithValue(getApiErrorMessage(e));
  }
});
export const closeNg = createAsyncThunk<
  NgCase,
  { id: string; requestId: string; reason: string; action: "CLOSE" | "CANCEL" },
  { rejectValue: string }
>("phaseOne/closeNg", async ({ id, ...body }, { rejectWithValue }) => {
  try {
    return (
      await post<ApiSuccessEnvelope<NgCase>>(
        `/production/material-ng-cases/${id}/close`,
        body,
      )
    ).data;
  } catch (e) {
    return rejectWithValue(getApiErrorMessage(e));
  }
});
const slice = createSlice({
  name: "phaseOne",
  initialState: {
    revisionQuery: { page: 1, limit: 20 } as ListQuery,
    traceQuery: { page: 1, limit: 20 } as ListQuery,
  },
  reducers: {
    setRevisionQuery(s, a: { payload: ListQuery }) {
      s.revisionQuery = a.payload;
    },
    setTraceQuery(s, a: { payload: ListQuery }) {
      s.traceQuery = a.payload;
    },
  },
});
export const { setRevisionQuery, setTraceQuery } = slice.actions;
export default slice.reducer;
