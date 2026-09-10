/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/

import { RootState } from '@/store';

/**
 * Get token from Redux state
 * Token is now stored in httpOnly cookie and managed by the auth slice
 */
export function getToken(state: RootState): string | null {
    return state.auth.token;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(state: RootState): boolean {
    return state.auth.isAuthenticated;
}

/**
 * Get current user
 */
export function getUser(state: RootState) {
    return state.auth.user;
}