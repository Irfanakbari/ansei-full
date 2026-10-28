import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  get,
  getApiErrorMessage,
  patch,
  type ApiSuccessEnvelope,
} from "@/store/utils/apiService";

export interface AssemblyProcessSetting {
  Id: number;
  BypassAllAssembly: boolean;
  ChangeReason: string | null;
  UpdatedAt: string;
  UpdatedBy: string;
  UpdatedByName?: string | null;
}

interface AssemblyProcessSettingState {
  data: AssemblyProcessSetting | null;
  loading: boolean;
  updating: boolean;
  error: string | null;
}

const initialState: AssemblyProcessSettingState = {
  data: null,
  loading: false,
  updating: false,
  error: null,
};

export const fetchAssemblyProcessSetting = createAsyncThunk<
  AssemblyProcessSetting,
  void,
  { rejectValue: string }
>("assemblyProcessSetting/fetch", async (_, { rejectWithValue }) => {
  try {
    const response = await get<ApiSuccessEnvelope<AssemblyProcessSetting>>(
      "/settings/assembly-process",
    );
    return response.data;
  } catch (error: unknown) {
    return rejectWithValue(
      getApiErrorMessage(error, "Failed to load assembly process setting"),
    );
  }
});

export const updateAssemblyProcessSetting = createAsyncThunk<
  AssemblyProcessSetting,
  {
    bypassAllAssembly: boolean;
    reason: string;
    expectedUpdatedAt: string;
  },
  { rejectValue: string }
>("assemblyProcessSetting/update", async (data, { rejectWithValue }) => {
  try {
    const response = await patch<
      ApiSuccessEnvelope<AssemblyProcessSetting>,
      typeof data
    >("/settings/assembly-process", data);
    return response.data;
  } catch (error: unknown) {
    return rejectWithValue(
      getApiErrorMessage(error, "Failed to update assembly process setting"),
    );
  }
});

const slice = createSlice({
  name: "assemblyProcessSetting",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAssemblyProcessSetting.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAssemblyProcessSetting.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchAssemblyProcessSetting.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to load setting";
      })
      .addCase(updateAssemblyProcessSetting.pending, (state) => {
        state.updating = true;
        state.error = null;
      })
      .addCase(updateAssemblyProcessSetting.fulfilled, (state, action) => {
        state.updating = false;
        state.data = action.payload;
      })
      .addCase(updateAssemblyProcessSetting.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload ?? "Failed to update setting";
      });
  },
});

export default slice.reducer;
