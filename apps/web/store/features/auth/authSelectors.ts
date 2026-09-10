/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/

import { RootState } from '@/store';

export const selectAuthUser = (state: RootState) => state.auth.user;
export const selectAuthToken = (state: RootState) => state.auth.token;
export const selectAuthLoading = (state: RootState) => state.auth.loading;
export const selectAuthError = (state: RootState) => state.auth.error;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectAuthIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;