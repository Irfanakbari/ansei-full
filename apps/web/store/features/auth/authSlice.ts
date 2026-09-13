/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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
});

export const { logout, setToken, setAuthData, setAuthError, setAuthLoading, clearAuth } = authSlice.actions;
export default authSlice.reducer;