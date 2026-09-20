/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/
import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {del, get, getApiErrorMessage, patch, post, type ApiSuccessEnvelope} from '../../utils/apiService';

export interface PermissionData {
    Id: number;
    Action: string;
    Description: string | null;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string | null;
    UpdatedAt: string;
    UpdatedBy: string | null;
    UpdatedByName?: string | null;
}

interface PermissionsState {
    data: PermissionData[];
    loading: boolean;
    error: string | null;
}

const initialState: PermissionsState = {
    data: [],
    loading: false,
    error: null,
};

export const fetchPermissions = createAsyncThunk<ApiSuccessEnvelope<PermissionData[]>, void, { rejectValue: string }>(
    'permissions/fetchAll',
    async (_, {rejectWithValue}) => {
        try {
            return await get<ApiSuccessEnvelope<PermissionData[]>>('/permissions');
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch permissions'));
        }
    }
);

export const createPermission = createAsyncThunk<ApiSuccessEnvelope<PermissionData>, {
    Action: string;
    Description?: string
}, { rejectValue: string }>(
    'permissions/create',
    async (permissionData, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<PermissionData>, typeof permissionData>('/permissions', permissionData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create permission'));
        }
    }
);

export const updatePermission = createAsyncThunk<ApiSuccessEnvelope<PermissionData>, {
    id: number;
    permissionData: { Action: string; Description?: string }
}, { rejectValue: string }>(
    'permissions/update',
    async ({id, permissionData}, {rejectWithValue}) => {
        try {
            return await patch<ApiSuccessEnvelope<PermissionData>, typeof permissionData>(`/permissions/${id}`, permissionData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update permission'));
        }
    }
);

export const deletePermission = createAsyncThunk<number, number, { rejectValue: string }>(
    'permissions/delete',
    async (id: number, {rejectWithValue}) => {
        try {
            await del<ApiSuccessEnvelope<unknown>>(`/permissions/${id}`);
            return id;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete permission'));
        }
    }
);

const permissionsSlice = createSlice({
    name: 'permissions',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchPermissions.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPermissions.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
            })
            .addCase(fetchPermissions.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export default permissionsSlice.reducer;