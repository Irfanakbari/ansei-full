/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { fetchWithAuth } from '@/store/utils/fetchWithAuth';
import { getTokenFromCookie } from '@/app/api/auth/_lib/token-client';

interface User {
    UserId: string;
    Name: string;
    Email: string;
    LastLogin: string;
    DeptPermission: string[];
    RoleName: string;
    Permission: string[];
    GlobalRoles?: string[];
}

interface AuthState {
    user: User | null;
    token: string | null;
    loading: boolean;
    error: string | null;
    isAuthenticated: boolean;
}

const initialState: AuthState = {
    user: null,
    token: null,
    loading: false,
    error: null,
    isAuthenticated: false,
};

export const loginUser = createAsyncThunk(
    'auth/login',
    async (credentials: { username: string; password: string }, { rejectWithValue }) => {
        try {
            const response = await fetch('/ansei/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // Important: include cookies in request
                body: JSON.stringify(credentials),
            });

            if (!response.ok) {
                const errorData = await response.json();
                return rejectWithValue(errorData.message || 'Login failed');
            }

            const data = await response.json();
            // Token is now stored in httpOnly cookie via API route
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Login failed');
        }
    }
);

export const logoutUser = createAsyncThunk(
    'auth/logout',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetch('/ansei/api/auth/logout', {
                method: 'POST',
                credentials: 'include', // Important: include cookies in request
            });

            if (!response.ok) {
                const errorData = await response.json();
                return rejectWithValue(errorData.message || 'Logout failed');
            }

            return true;
        } catch (error: any) {
            return rejectWithValue(error.message || 'Logout failed');
        }
    }
);

export const fetchUserProfile = createAsyncThunk(
    'auth/profile',
    async (_, { rejectWithValue }) => {
        try {
            // Get token from httpOnly cookie
            const token = await getTokenFromCookie();

            if (!token) {
                return rejectWithValue('No token found');
            }

            const response = await fetchWithAuth('/api/auth/profile', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });

            if (!response.ok) {
                return rejectWithValue('Failed to fetch profile');
            }

            return await response.json();
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to fetch profile');
        }
    }
);

export const checkAuthStatus = createAsyncThunk(
    'auth/checkStatus',
    async (_, { rejectWithValue }) => {
        try {
            const token = await getTokenFromCookie();
            if (token) {
                // Token exists, fetch profile to validate and get user data
                const response = await fetchWithAuth('/api/auth/profile', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                });

                if (response.ok) {
                    const userData = await response.json();
                    return { token, user: userData };
                } else {
                    // Token might be expired
                    return rejectWithValue('Token expired');
                }
            }
            return rejectWithValue('No token found');
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to check auth status');
        }
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        logout: (state) => {
            state.user = null;
            state.token = null;
            state.error = null;
            state.isAuthenticated = false;
        },
        setToken: (state, action: PayloadAction<string>) => {
            state.token = action.payload;
        },
        setAuthData: (state, action: PayloadAction<{ user: User; token: string }>) => {
            state.user = action.payload.user;
            state.token = action.payload.token;
            state.isAuthenticated = true;
            state.loading = false;
            state.error = null;
        },
        setAuthError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.loading = false;
        },
        setAuthLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        clearAuth: (state) => {
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
            state.error = null;
            state.loading = false;
        }
    },
    extraReducers: (builder) => {
        builder
            // Login
            .addCase(loginUser.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.loading = false;
                state.token = action.payload.AccessToken;
                state.user = action.payload.User;
                state.isAuthenticated = true;
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
                state.isAuthenticated = false;
            })
            // Logout
            .addCase(logoutUser.pending, (state) => {
                state.loading = true;
            })
            .addCase(logoutUser.fulfilled, (state) => {
                state.loading = false;
                state.user = null;
                state.token = null;
                state.isAuthenticated = false;
                state.error = null;
            })
            .addCase(logoutUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Profile
            .addCase(fetchUserProfile.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchUserProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.user = action.payload;
            })
            .addCase(fetchUserProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Check Auth Status
            .addCase(checkAuthStatus.pending, (state) => {
                state.loading = true;
            })
            .addCase(checkAuthStatus.fulfilled, (state, action) => {
                state.loading = false;
                state.token = action.payload.token;
                state.user = action.payload.user;
                state.isAuthenticated = true;
            })
            .addCase(checkAuthStatus.rejected, (state) => {
                state.loading = false;
                state.user = null;
                state.token = null;
                state.isAuthenticated = false;
            });
    },
});

export const { logout, setToken, setAuthData, setAuthError, setAuthLoading, clearAuth } = authSlice.actions;
export default authSlice.reducer;