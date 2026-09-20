/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/
import {createSlice, createAsyncThunk} from '@reduxjs/toolkit';
import {
    del,
    get,
    getApiErrorMessage,
    patch,
    post,
    type ApiSuccessEnvelope,
    type PaginatedApiSuccessEnvelope,
    type PaginationMeta
} from '../../utils/apiService';

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
    Role?: { Id: number; RoleName: string; Description?: string | null } | null;
    CreatedAt: string;
    CreatedBy: string;
    CreatedByName?: string | null;
    UpdatedAt: string;
    UpdatedBy: string | null;
    UpdatedByName?: string | null;
}

export interface CreateUserPayload {
    UserId: string;
    SsoObjectId: string;
    Name: string;
    Email: string;
    PhoneNumber?: string;
    RoleId?: number;
    IsActive?: boolean;
    DeptPermission?: string[];
}

export interface UpdateUserPayload {
    Name?: string;
    Email?: string;
    PhoneNumber?: string;
    RoleId?: number | null;
    IsActive?: boolean;
    DeptPermission?: string[];
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
    pagination: {page: 1, limit: 50, totalItems: 0, totalPages: 0},
};

export interface UserQuery {
    page?: number;
    limit?: number;
    search?: string
}

export const fetchUsers = createAsyncThunk<PaginatedApiSuccessEnvelope<UserManagementEntity>, UserQuery | undefined, {
    rejectValue: string
}>(
    'users/fetchAll',
    async (params = {}, {rejectWithValue}) => {
        try {
            return await get<PaginatedApiSuccessEnvelope<UserManagementEntity>>('/users', {params: {...params}});
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch users'));
        }
    }
);

export const createUser = createAsyncThunk<ApiSuccessEnvelope<UserManagementEntity>, CreateUserPayload, {
    rejectValue: string
}>(
    'users/create',
    async (userData, {rejectWithValue}) => {
        try {
            return await post<ApiSuccessEnvelope<UserManagementEntity>, CreateUserPayload>('/users', userData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to create user'));
        }
    }
);

export const updateUser = createAsyncThunk<ApiSuccessEnvelope<UserManagementEntity>, {
    id: string;
    userData: UpdateUserPayload
}, { rejectValue: string }>(
    'users/update',
    async ({id, userData}, {rejectWithValue}) => {
        try {
            return await patch<ApiSuccessEnvelope<UserManagementEntity>, UpdateUserPayload>(`/users/${id}`, userData);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update user'));
        }
    }
);

export const deleteUser = createAsyncThunk<string, string, { rejectValue: string }>(
    'users/delete',
    async (id: string, {rejectWithValue}) => {
        try {
            await del<ApiSuccessEnvelope<unknown>>(`/users/${id}`);
            return id;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete user'));
        }
    }
);

const usersSlice = createSlice({
    name: 'users',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchUsers.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchUsers.fulfilled, (state, action) => {
                state.loading = false;
                state.data = Array.isArray(action.payload?.data) ? action.payload.data : [];
                state.pagination = action.payload.meta ?? initialState.pagination;
            })
            .addCase(fetchUsers.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            .addCase(deleteUser.fulfilled, (state, action) => {
                state.data = state.data.filter(u => u.UserId !== action.payload && u.Id !== action.payload);
            });
    },
});

export default usersSlice.reducer;