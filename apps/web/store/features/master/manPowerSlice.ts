/*By Irfan Akbari Vuteq Indonesia - 2026-06-07 - Updated 2026-09-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { del, get, getApiErrorMessage, patch, post, postFormData, type ApiSuccessEnvelope, type PaginatedApiSuccessEnvelope } from '../../utils/apiService';

export interface ManPowerEntity {
    Uid: string;
    Nik: string;
    Name: string;
    CreatedAt: string;
    Status: boolean;
    Line: string | null;
    PicturePath?: string | null;
}

interface ManPowerState {
    data: ManPowerEntity[];
    loading: boolean;
    error: string | null;
    query: ManPowerQuery;
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
}
export interface ManPowerQuery { page?: number; limit?: number; search?: string }

const initialState: ManPowerState = {
    data: [],
    loading: false,
    error: null,
    query: { page: 1, limit: 50 },
    pagination: { page: 1, limit: 50, totalItems: 0, totalPages: 0 },
};

export const fetchManPower = createAsyncThunk<PaginatedApiSuccessEnvelope<ManPowerEntity>, ManPowerQuery | undefined, { rejectValue: string }>(
    'manPower/fetchAll',
    async (query = {}, { rejectWithValue }) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<ManPowerEntity>>('/master/man-power', { params: { page: query.page, limit: query.limit, search: query.search } });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch man power data'));
        }
    }
);

export const createManPower = createAsyncThunk(
    'manPower/create',
    async (manPowerData: {
        nik: string;
        name: string;
        line?: string;
        status?: boolean;
    }, { rejectWithValue }) => {
        try {
            return await post<ApiSuccessEnvelope<ManPowerEntity>, typeof manPowerData>('/master/man-power', manPowerData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create man power'));
        }
    }
);

export const updateManPower = createAsyncThunk(
    'manPower/update',
    async ({ uid, data: updateData }: {
        uid: string;
        data: {
            nik?: string;
            name?: string;
            line?: string;
            status?: boolean;
        }
    }, { rejectWithValue }) => {
        try {
            return await patch<ApiSuccessEnvelope<ManPowerEntity>, typeof updateData>(`/master/man-power/${uid}`, updateData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update man power'));
        }
    }
);

export const deleteManPower = createAsyncThunk(
    'manPower/delete',
    async (uid: string, { rejectWithValue }) => {
        try {
            await del<ApiSuccessEnvelope<unknown>>(`/master/man-power/${uid}`);
            return uid;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete man power'));
        }
    }
);

export const uploadManPowerPicture = createAsyncThunk(
    'manPower/uploadPicture',
    async ({ uid, file }: { uid: string; file: File }, { rejectWithValue }) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            return await postFormData<ApiSuccessEnvelope<ManPowerEntity>>(`/master/man-power/${uid}/picture`, formData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to upload picture'));
        }
    }
);

export const deleteManPowerPicture = createAsyncThunk(
    'manPower/deletePicture',
    async (uid: string, { rejectWithValue }) => {
        try {
            const result = await del<ApiSuccessEnvelope<ManPowerEntity>>(`/master/man-power/${uid}/picture`);
            return { uid, data: result?.data };
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete picture'));
        }
    }
);

const manPowerSlice = createSlice({
    name: 'manPower',
    initialState,
    reducers: { setManPowerQuery: (state, action: { payload: ManPowerQuery }) => { state.query = { ...state.query, ...action.payload }; } },
    extraReducers: (builder) => {
        builder
            .addCase(fetchManPower.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchManPower.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
                state.pagination = action.payload.meta ?? initialState.pagination;
            })
            .addCase(fetchManPower.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            .addCase(uploadManPowerPicture.fulfilled, (state, action) => {
                const updated = action.payload?.data;
                if (updated) {
                    const idx = state.data.findIndex((m) => m.Uid === updated.Uid);
                    if (idx !== -1) {
                        state.data[idx] = updated;
                    }
                }
            })
            .addCase(deleteManPowerPicture.fulfilled, (state, action) => {
                const uid = action.payload?.uid;
                if (uid) {
                    const idx = state.data.findIndex((m) => m.Uid === uid);
                    if (idx !== -1) {
                        state.data[idx].PicturePath = null;
                    }
                }
            });
    },
});

export const { setManPowerQuery } = manPowerSlice.actions;
export default manPowerSlice.reducer;