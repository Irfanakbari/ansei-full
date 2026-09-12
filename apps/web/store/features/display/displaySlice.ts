/* By Irfan Akbari Vuteq Indonesia - 2026-08-20 */

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

export interface ActiveDisplayConfig {
    Id: number;
    Url: string;
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
    void,
    { rejectValue: string }
>('display/fetchActive', async (_, { rejectWithValue }) => {
    try {
        const response = await fetch('/ansei/api/display', { cache: 'no-store' });
        const data: unknown = await response.json();

        if (!response.ok) {
            const message =
                typeof data === 'object' &&
                data !== null &&
                'message' in data &&
                typeof data.message === 'string'
                    ? data.message
                    : 'Failed to fetch active display configuration';
            return rejectWithValue(message);
        }

        return data as ActiveDisplayConfig | null;
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
