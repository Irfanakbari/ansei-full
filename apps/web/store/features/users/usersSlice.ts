/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { get, getApiErrorMessage, type PaginatedApiSuccessEnvelope, type PaginationMeta } from '../../utils/apiService';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

export interface UserManagementEntity {
    Id: string;
    UserId: string;
    SsoObjectId: string;
    IsActive: boolean;
    Name: string;
    LastLogin: string | null;
    Email: string;
    PhoneNumber: string | null;
    DeptPermission: string[];
    RoleId: number | null;
}

interface UserState {
    data: UserManagementEntity[];
    loading: boolean;
    error: string | null;
    pagination: PaginationMeta;
}

const initialState: UserState = {
    data: [],
    loading: false,
    error: null,
    pagination: { page: 1, limit: 50, totalItems: 0, totalPages: 0 },
};

export interface UserQuery { page?: number; limit?: number; search?: string }

export const fetchUsers = createAsyncThunk<PaginatedApiSuccessEnvelope<UserManagementEntity>, UserQuery | undefined, { rejectValue: string }>(
    'users/fetchAll',
    async (params = {}, { rejectWithValue }) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<UserManagementEntity>>('/users', { params: { ...params } });
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch users'));
        }
    }
);

export const createUser = createAsyncThunk(
    'users/create',
    async (userData: any, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to create user');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const updateUser = createAsyncThunk(
    'users/update',
    async ({ id, userData }: { id: string; userData: any }, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData),
            });
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to update user');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const deleteUser = createAsyncThunk(
    'users/delete',
    async (id: string, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth(`/api/users/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return rejectWithValue(data.message || 'Failed to delete user');
            return id;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const usersSlice = createSlice({
    name: 'users',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchUsers.pending, (state) => { state.loading = true; state.error = null; })
            .addCase(fetchUsers.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload.data;
                state.pagination = action.payload.meta;
            })
            .addCase(fetchUsers.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export default usersSlice.reducer;