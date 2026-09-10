/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

export interface RoleData {
    Id: number;
    RoleName: string;
    Description: string;
    Permission?: { Id: number; Action: string; Description: string }[];
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

export const fetchRoles = createAsyncThunk(
    'roles/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/roles');
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch roles');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const createRole = createAsyncThunk(
    'roles/create',
    async (roleData: { RoleName: string; Description: string }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(roleData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to create role');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const updateRole = createAsyncThunk(
    'roles/update',
    async ({ id, roleData }: { id: number; roleData: { RoleName: string; Description: string } }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/roles/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(roleData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to update role');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteRole = createAsyncThunk(
    'roles/delete',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/roles/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete role');
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const assignPermissionToRole = createAsyncThunk(
    'roles/assignPermission',
    async ({ roleId, permissionId }: { roleId: number; permissionId: number }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/roles/${roleId}/permissions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissionId }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to assign permission');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const removePermissionFromRole = createAsyncThunk(
    'roles/removePermission',
    async ({ roleId, permissionId }: { roleId: number; permissionId: number }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/roles/${roleId}/permissions/${permissionId}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to remove permission');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const rolesSlice = createSlice({
    name: 'roles',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchRoles.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchRoles.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
            })
            .addCase(fetchRoles.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export default rolesSlice.reducer;