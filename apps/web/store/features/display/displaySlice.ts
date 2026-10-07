/* By Irfan Akbari Vuteq Indonesia - 2026-08-20 - Updated 2026-09-17 */

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { withBasePath } from "@/lib/base-path";
import { normalizeNasMediaUrl } from "@/lib/nas-media-url";

export interface ActiveDisplayConfig {
  Id: number;
  Url: string | null;
  FilePath: string | null;
  Line: string | null;
  Loop: boolean;
}

export interface DisplayTarget {
  partNumber: string;
  partName: string;
  alias: string | null;
  targetQty: number;
  actualQty: number;
  productionReleaseId: string | null;
  releaseNumber: string | null;
}

interface DisplayState {
  config: ActiveDisplayConfig | null;
  loading: boolean;
  target: DisplayTarget | null;
  targetLoading: boolean;
  targetError: string | null;
}

const initialState: DisplayState = {
  config: null,
  loading: true,
  target: null,
  targetLoading: false,
  targetError: null,
};

function getResponseMessage(data: unknown, fallback: string): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof data.message === "string"
  ) {
    return data.message;
  }

  return fallback;
}

function unwrapPayload(data: unknown): unknown {
  if (typeof data === "object" && data !== null && "data" in data) {
    return data.data;
  }

  return data;
}

export const fetchActiveDisplayConfig = createAsyncThunk<
  ActiveDisplayConfig | null,
  string | null | undefined,
  { rejectValue: string }
>("display/fetchActive", async (line, { rejectWithValue }) => {
  try {
    const query = line ? `?line=${encodeURIComponent(line)}` : "";
    const response = await fetch(withBasePath(`/api/display${query}`), {
      cache: "no-store",
    });
    const data: unknown = await response.json();

    if (!response.ok) {
      return rejectWithValue(
        getResponseMessage(
          data,
          "Failed to fetch active display configuration",
        ),
      );
    }

    return unwrapPayload(data) as ActiveDisplayConfig | null;
  } catch {
    return rejectWithValue("Failed to fetch active display configuration");
  }
});

export const fetchDisplayTarget = createAsyncThunk<
  DisplayTarget,
  string,
  { rejectValue: string }
>("display/fetchTarget", async (partNumber, { rejectWithValue }) => {
  try {
    const query = new URLSearchParams({ partNumber });
    const response = await fetch(
      withBasePath(`/api/display/target?${query.toString()}`),
      {
        cache: "no-store",
      },
    );
    const data: unknown = await response.json();

    if (!response.ok) {
      return rejectWithValue(
        getResponseMessage(
          data,
          "Failed to fetch the active production target",
        ),
      );
    }

    return unwrapPayload(data) as DisplayTarget;
  } catch {
    return rejectWithValue("Failed to fetch the active production target");
  }
});

const displaySlice = createSlice({
  name: "display",
  initialState,
  reducers: {
    clearDisplayTarget(state) {
      state.target = null;
      state.targetError = null;
      state.targetLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActiveDisplayConfig.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchActiveDisplayConfig.fulfilled, (state, action) => {
        state.config = action.payload
          ? {
              ...action.payload,
              Url: normalizeNasMediaUrl(action.payload.Url),
              FilePath: normalizeNasMediaUrl(action.payload.FilePath),
            }
          : null;
        state.loading = false;
      })
      .addCase(fetchActiveDisplayConfig.rejected, (state) => {
        state.config = null;
        state.loading = false;
      })
      .addCase(fetchDisplayTarget.pending, (state) => {
        state.targetLoading = true;
        state.targetError = null;
      })
      .addCase(fetchDisplayTarget.fulfilled, (state, action) => {
        state.target = action.payload;
        state.targetLoading = false;
      })
      .addCase(fetchDisplayTarget.rejected, (state, action) => {
        state.target = null;
        state.targetLoading = false;
        state.targetError =
          action.payload ?? "Failed to fetch the active production target";
      });
  },
});

export const { clearDisplayTarget } = displaySlice.actions;
export default displaySlice.reducer;
