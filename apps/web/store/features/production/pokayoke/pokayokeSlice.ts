/*By Irfan Akbari Vuteq Indonesia - 2026-06-09 - Updated 2026-06-16*/
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '@/store/utils/fetchWithAuth';

// Pokayoke scan entity interface
export interface PokayokeScanEntity {
    id: number;
    labelNumber: string;
    poId: string;
    partNumber: string;
    partName: string;
    status: 'SUKSES' | 'GAGAL';
    createdAt: string;
    createdBy: string;
}

// Scan response interface
export interface PokayokeScanResponse {
    success: boolean;
    message: string;
    data?: PokayokeScanEntity;
    error?: string;
}

// Scan request interface
export interface PokayokeScanRequest {
    labelNumber: string;
    status: string;
}

// Pokayoke state
interface PokayokeState {
    data: PokayokeScanEntity[];
    loading: boolean;
    scanning: boolean;
    error: string | null;
    scanResult: PokayokeScanResponse | null;
}

const initialState: PokayokeState = {
    data: [],
    loading: false,
    scanning: false,
    error: null,
    scanResult: null,
};

// Fetch all pokayoke scans
export const fetchPokayoke = createAsyncThunk(
    'pokayoke/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/production/pokayoke');
            const data = await response.json();
            if (!response.ok) return rejectWithValue(data.message || 'Failed to fetch pokayoke data');
            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

// Scan pokayoke
export const scanPokayoke = createAsyncThunk(
    'pokayoke/scan',
    async (scanData: PokayokeScanRequest, { rejectWithValue }) => {
        try {
            const response = await fetchWithAuth('/api/production/pokayoke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scanData),
            });
            const data = await response.json();

            // Handle HTTP errors
            if (!response.ok) {
                return rejectWithValue(data.message || 'Failed to scan pokayoke');
            }

            // Handle business logic errors (HTTP 200 but success: false)
            if (data.success === false) {
                return rejectWithValue(data.message || data.error || 'Scan failed');
            }

            return data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const pokayokeSlice = createSlice({
    name: 'pokayoke',
    initialState,
    reducers: {
        clearScanResult: (state) => {
            state.scanResult = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Fetch all
            .addCase(fetchPokayoke.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPokayoke.fulfilled, (state, action) => {
                state.loading = false;
                // Handle both array and paginated response
                state.data = Array.isArray(action.payload) ? action.payload : (action.payload?.data || []);
            })
            .addCase(fetchPokayoke.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            // Scan
            .addCase(scanPokayoke.pending, (state) => {
                state.scanning = true;
                state.error = null;
            })
            .addCase(scanPokayoke.fulfilled, (state, action) => {
                state.scanning = false;
                state.scanResult = action.payload;
            })
            .addCase(scanPokayoke.rejected, (state, action) => {
                state.scanning = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearScanResult } = pokayokeSlice.actions;
export default pokayokeSlice.reducer;