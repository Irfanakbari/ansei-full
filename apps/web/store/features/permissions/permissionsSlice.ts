/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

export interface PermissionData {
    Id: number;
    Action: string;
    Description: string;
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

export const fetchPermissions = createAsyncThunk(
    'permissions/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/permissions');
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch permissions');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const createPermission = createAsyncThunk(
    'permissions/create',
    async (permissionData: { Action: string; Description: string }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(permissionData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to create permission');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const updatePermission = createAsyncThunk(
    'permissions/update',
    async ({ id, permissionData }: { id: number; permissionData: { Action: string; Description: string } }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/permissions/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(permissionData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to update permission');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const deletePermission = createAsyncThunk(
    'permissions/delete',
    async (id: number, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/permissions/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete permission');
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const permissionsSlice = createSlice({
    name: 'permissions',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchPermissions.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchPermissions.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
            })
            .addCase(fetchPermissions.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export default permissionsSlice.reducer;