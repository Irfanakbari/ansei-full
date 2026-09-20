/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/
import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {del, get, getApiErrorMessage, patch, post, type ApiSuccessEnvelope} from '../../utils/apiService';

export interface RoleData {
    Id: number;
    RoleName: string;
    Description: string;
    Permission?: { Id: number; Action: string; Description: string }[];
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string | null;
    UpdatedAt: string;
    UpdatedBy: string | null;
    UpdatedByName?: string | null;
}

interface RolesState {
    data: RoleData[];
    loading: boolean;
    error: string | null;
}

const initialState: RolesState = {
    data: [],
    loading: false,
    error: null,
};

export const fetchRoles = createAsyncThunk<ApiSuccessEnvelope<RoleData[]>, void, { rejectValue: string }>(
    'roles/fetchAll',
    async (_, {rejectWithValue}) => {
        try {
            return await get<ApiSuccessEnvelope<RoleData[]>>('/roles');
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch roles'));
        }
    }
);

export const createRole = createAsyncThunk<ApiSuccessEnvelope<RoleData>, { RoleName: string; Description: string }, {
    rejectValue: string
}>(
    'roles/create',
    async (roleData: { RoleName: string; Description: string }, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<RoleData>, typeof roleData>('/roles', roleData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create role'));
        }
    }
);

export const updateRole = createAsyncThunk<ApiSuccessEnvelope<RoleData>, {
    id: number;
    roleData: { RoleName: string; Description: string }
}, { rejectValue: string }>(
    'roles/update',
    async ({id, roleData}: { id: number; roleData: { RoleName: string; Description: string } }, {rejectWithValue}) => {
        try {
            return await patch<ApiSuccessEnvelope<RoleData>, typeof roleData>(`/roles/${id}`, roleData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update role'));
        }
    }
);

export const deleteRole = createAsyncThunk<number, number, { rejectValue: string }>(
    'roles/delete',
    async (id: number, {rejectWithValue}) => {
        try {
            await del<ApiSuccessEnvelope<unknown>>(`/roles/${id}`);
            return id;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete role'));
        }
    }
);

export const assignPermissionToRole = createAsyncThunk<ApiSuccessEnvelope<RoleData>, {
    roleId: number;
    permissionId: number
}, { rejectValue: string }>(
    'roles/assignPermission',
    async ({roleId, permissionId}: { roleId: number; permissionId: number }, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<RoleData>, {
                permissionId: number
            }>(`/roles/${roleId}/permissions`, {permissionId});
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to assign permission'));
        }
    }
);

export const removePermissionFromRole = createAsyncThunk<ApiSuccessEnvelope<RoleData>, {
    roleId: number;
    permissionId: number
}, { rejectValue: string }>(
    'roles/removePermission',
    async ({roleId, permissionId}: { roleId: number; permissionId: number }, {rejectWithValue}) => {
        try {
            return await del<ApiSuccessEnvelope<RoleData>>(`/roles/${roleId}/permissions/${permissionId}`);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to remove permission'));
        }
    }
);

const rolesSlice = createSlice({
    name: 'roles',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchRoles.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchRoles.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
            })
            .addCase(fetchRoles.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export default rolesSlice.reducer;