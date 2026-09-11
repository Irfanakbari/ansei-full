/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
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
}

const initialState: UserState = {
    data: [],
    loading: false,
    error: null,
};

export const fetchUsers = createAsyncThunk(
    'users/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/users');
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch users');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
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
                state.data = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
            })
            .addCase(fetchUsers.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export default usersSlice.reducer;