/* By Irfan Akbari Vuteq Indonesia - 2026-08-20 */

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

export interface ActiveDisplayConfig {
    Id: number;
    Url: string | null;
    FilePath: string | null;
    Line: string | null;
    Loop: boolean;
}

interface DisplayState {
    config: ActiveDisplayConfig | null;
    loading: boolean;
}

const initialState: DisplayState = {
    config: null,
    loading: true,
};

export const fetchActiveDisplayConfig = createAsyncThunk<
    ActiveDisplayConfig | null,
    string | null | undefined,
    { rejectValue: string }
>('display/fetchActive', async (line, { rejectWithValue }) => {
    try {
        const query = line ? `?line=${encodeURIComponent(line)}` : '';
        const response = await fetch(`/api/display${query}`, { cache: 'no-store' });
        const data: unknown = await response.json();

        if (!response.ok) {
            const message =
                typeof data === 'object' &&
                data !== null &&
                'message' in data &&
                typeof (data as any).message === 'string'
                    ? (data as any).message
                    : 'Failed to fetch active display configuration';
            return rejectWithValue(message);
        }

        const payloadData = (data as any)?.data;
        return payloadData as ActiveDisplayConfig | null;
    } catch {
        return rejectWithValue('Failed to fetch active display configuration');
    }
});

const displaySlice = createSlice({
    name: 'display',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchActiveDisplayConfig.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchActiveDisplayConfig.fulfilled, (state, action) => {
                state.config = action.payload;
                state.loading = false;
            })
            .addCase(fetchActiveDisplayConfig.rejected, (state) => {
                state.config = null;
                state.loading = false;
            });
    },
});

export default displaySlice.reducer;
