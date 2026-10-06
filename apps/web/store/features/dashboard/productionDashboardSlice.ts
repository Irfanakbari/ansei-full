/* By Irfan Akbari Vuteq Indonesia - 2026-10-06 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { withBasePath } from "@/lib/base-path";

export type ProductionStageStatus =
    "PENDING" | "IN_PROGRESS" | "COMPLETE" | "UNAVAILABLE";
export interface ProductionDashboardMetrics {
    releaseCount: number;
    poCount: number;
    completedPo: number;
    partialPo: number;
    planQty: number;
    producedQty: number;
    deliveredQty: number;
    remainingQty: number;
    labelCount: number;
    deliveredLabels: number;
    validatedLabels: number;
    validatedQty: number;
    awaitingDeliveryQty: number;
    awaitingDeliveryLabels: number;
    cycleBlockedQty: number;
    shoppingCompletePo: number;
    shoppingStartedPo: number;
    assemblyLabels: number;
    assemblyComplete: number;
    assemblyRunning: number;
    directFlowPo: number;
    overduePo: number;
    overdueQty: number;
    issuePo: number;
    openFindings: number;
    waitingPartChange: number;
    cycleCount: number;
    cycleComplete: number;
    cycleBlocked: number;
}
export interface ProductionDashboardHour {
    hour: string;
    producedQty: number;
    deliveredQty: number;
}
export interface ProductionDashboardOrder {
    poId: string;
    partNumber: string;
    partName: string;
    period: number;
    deliveryDate: string;
    planQty: number;
    producedQty: number;
    deliveredQty: number;
    remainingQty: number;
    labels: number;
    deliveredLabels: number;
    validatedLabels: number;
    awaitingDeliveryQty: number;
    deliveryComplete: boolean;
    overdue: boolean;
    cycleBlocked: boolean;
    shoppingStatus: ProductionStageStatus;
    productionStatus: ProductionStageStatus;
    pokayokeStatus: ProductionStageStatus;
    issues: string[];
}
export interface ProductionDashboardCycle {
    period: number;
    status: "COMPLETE" | "CURRENT" | "BLOCKED";
    blockedByPeriod: number | null;
    poCount: number;
    completedPo: number;
    planQty: number;
    deliveredQty: number;
    remainingQty: number;
    labels: number;
    deliveredLabels: number;
    awaitingDeliveryQty: number;
}
export interface ProductionDashboardRelease {
    id: string;
    releaseNumber: string;
    planDate: string;
    metrics: ProductionDashboardMetrics;
    orders: ProductionDashboardOrder[];
    cycles: ProductionDashboardCycle[];
    hourly: ProductionDashboardHour[];
}
export interface ProductionDashboardData {
    generatedAt: string;
    timezone: string;
    refreshSeconds: number;
    inventoryHolds: string[];
    metrics: ProductionDashboardMetrics;
    releases: ProductionDashboardRelease[];
    hourly: ProductionDashboardHour[];
}
interface ProductionDashboardState {
    data: ProductionDashboardData | null;
    loading: boolean;
    error: string | null;
}
const initialState: ProductionDashboardState = {
    data: null,
    loading: false,
    error: null,
};

// Public read-only display, following the existing display thunk transport.
export const fetchProductionDashboard = createAsyncThunk<
    ProductionDashboardData,
    void,
    {
        state: { productionDashboard: ProductionDashboardState };
        rejectValue: string;
    }
>(
    "productionDashboard/fetch",
    async (_, { signal, rejectWithValue }) => {
        try {
            const response = await fetch(withBasePath("/api/dashboard"), {
                cache: "no-store",
                credentials: "omit",
                signal: AbortSignal.any([signal, AbortSignal.timeout(18000)]),
            });
            if (!response.ok)
                return rejectWithValue(
                    "Production data is temporarily unavailable. Retrying automatically.",
                );
            const body: unknown = await response.json();
            const data =
                body && typeof body === "object" && "data" in body
                    ? body.data
                    : body;
            if (
                !data ||
                typeof data !== "object" ||
                !("releases" in data) ||
                !Array.isArray(data.releases) ||
                !("generatedAt" in data) ||
                typeof data.generatedAt !== "string"
            ) {
                return rejectWithValue(
                    "Production data could not be read. Retrying automatically.",
                );
            }
            return data as ProductionDashboardData;
        } catch {
            return rejectWithValue(
                "Connection interrupted. Retrying automatically.",
            );
        }
    },
    { condition: (_, { getState }) => !getState().productionDashboard.loading },
);

const slice = createSlice({
    name: "productionDashboard",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchProductionDashboard.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchProductionDashboard.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload;
                state.error = null;
            })
            .addCase(fetchProductionDashboard.rejected, (state, action) => {
                state.loading = false;
                if (!action.meta.aborted)
                    state.error =
                        action.payload ??
                        "Production data is temporarily unavailable.";
            });
    },
});
export default slice.reducer;
