/*By Irfan Akbari Vuteq Indonesia - 21 May 2026 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

export interface MTCUserSession {
    SessionId: string;
    UserId: string;
    UserAgent: string;
    IpAddress: string;
    IsActive: boolean;
    CreatedAt: string;
    ExpiresAt: string;
}

interface SessionState {
    sessions: MTCUserSession[];
    loading: boolean;
    error: string | null;
}

const initialState: SessionState = {
    sessions: [],
    loading: false,
    error: null,
};

export const fetchSessions = createAsyncThunk(
    'auth/fetchSessions',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/auth/sessions');
            if (!response.ok) {
                return rejectWithValue('Failed to fetch session data');
            }
            return await response.json();
        } catch (error: any) {
            return rejectWithValue(error.message || 'Failed to fetch session data');
        }
    }
);

const sessionSlice = createSlice({
    name: 'sessions',
    initialState,
    reducers: {
        clearSessions: (state) => {
            state.sessions = [];
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSessions.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchSessions.fulfilled, (state, action) => {
                state.loading = false;
                state.sessions = action.payload;
            })
            .addCase(fetchSessions.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearSessions } = sessionSlice.actions;
export default sessionSlice.reducer;