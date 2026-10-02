import {createAsyncThunk, createSlice} from "@reduxjs/toolkit";
import type {ApiSuccessEnvelope} from "@/store/utils/apiService";

export interface DashboardQuery {
    month: number;
    year: number;
}

export interface DashboardMeta {
    period: string;
    timezone: "Asia/Jakarta";
    periodStart: string;
    periodEndExclusive: string;
    asOf: string;
    productionOutputMetric: "reportedGoodQty";
    month?: string;
    generatedAt?: string;
}

export interface DashboardFreezeItem {
    id: string;
    opnameNumber: string;
    startedAt: string | null;
    progress: number;
}

export interface DashboardSnapshot {
    masterData: {
        activeMaterials: number;
        suppliers: number;
        finishGoods: number;
        activeManpower: number;
    };
    inventory: {
        outOfStockPartCount: number;
        lowStockPartCount: number;
        negativeBalancePartCount: number;
    };
    freezes: {
        activeMaterial: DashboardFreezeItem[];
        activeFinishGood: DashboardFreezeItem[];
    };
    openExceptions: {
        overdueForecastCount: number;
        openIncomingCount: number;
        unvalidatedReportCount: number;
        pendingLabelCount: number;
    };
    demand?: number;
    reportedGoodOutput?: number;
    delivered?: number;
    deliveryAttainment?: number | null;
    ngRate?: number | null;
    inventoryRisk?: number;
    incomingApproved?: number;
    incomingOpen?: number;
    assemblyActive?: number;
    pokayokePending?: number;
    pokayokeFailures?: number;
    unvalidatedReports?: number;
    stockOpnameFreezes?: number;
}

export interface DashboardMonthly {
    demand: { forecastCount: number; forecastQty: number; unscheduledCount: number; unscheduledQty: number; releasedQty: number };
    incoming: { approvedDocumentCount: number; approvedMaterialQty: number; openDocumentCount: number; activeSupplierCount?: number };
    production: {
        releaseCountsByStatus: Record<string, number>;
        targetQty: number;
        scannedGoodQty: number;
        productionAttainmentPct: number | null;
        reportedQty: number;
        reportedNgQty: number;
        ngRatePct: number | null;
        unvalidatedReportCount: number;
    };
    assembly: { inProgress: number; completed: number; cancelled: number };
    pokayoke: { scannedLabels: number; pendingLabels: number; failedAttempts: number };
    delivery: { deliveredQty: number; attainmentPct: number | null; overdueForecastCount: number; overdueOpenQty: number };
    reportedGoodOutput?: number;
    delivered?: number;
    deliveryAttainment?: number | null;
    ngRate?: number | null;
    inventoryRisk?: number;
    incomingApproved?: number;
    incomingOpen?: number;
    assemblyActive?: number;
    pokayokePending?: number;
    pokayokeFailures?: number;
    unvalidatedReports?: number;
    stockOpnameFreezes?: number;
    ngQty?: number;
    reportedQty?: number;
}

export interface DashboardDailyItem {
    date: string;
    demandQty: number;
    approvedIncomingMaterialQty: number;
    approvedIncomingDocumentCount?: number;
    reportedGoodQty: number;
    deliveredQty: number;
    reportedNgQty: number;
    demand?: number;
    goodOutput?: number;
    delivered?: number;
}

export interface DashboardReleasePipelineItem {
    releaseId: string;
    releaseNumber: string;
    planDate: string;
    status: string;
    targetQty: number;
    shoppingPct: number | null;
    assemblyPct: number | null;
    pokayokePct: number | null;
    deliveryPct: number | null;
    id?: string;
    finishGood?: string | null;
    shoppingProgress?: number | null;
    assemblyProgress?: number | null;
    pokayokeProgress?: number | null;
    deliveryProgress?: number | null;
    href?: string;
}

export interface DashboardInventoryRiskItem {
    id?: string;
    partNumber: string;
    partName?: string | null;
    totalStock: number;
    minimumStock: number;
    shortageQty: number;
    status: "OUT" | "LOW" | "NEGATIVE";
    onHand?: number;
    required?: number;
    shortage?: number;
    coverageDays?: number | null;
    severity?: "critical" | "warning" | "info" | string;
    href?: string;
}

export interface DashboardTopPartItem {
    partNumber: string;
    partName?: string | null;
    demandQty: number;
    deliveredQty: number;
    ngQty: number;
    quantity?: number;
}

export interface DashboardTopSupplierItem {
    supplierId: number;
    supplierName: string;
    documentCount: number;
    totalQty: number;
}

export interface DashboardTopIncomingMaterialItem {
    partNumber: string;
    partName: string;
    totalQty: number;
}

export interface DashboardRecentIncomingItem {
    id: string;
    poId: string;
    supplierName: string;
    approvedAt: string | null;
    createdAt: string;
    closed: boolean;
    totalQty: number;
    materialCount: number;
}

export interface DashboardExceptionItem {
    type: string;
    title: string;
    description: string;
    occurredAt: string;
    route: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
    id?: string;
    descriptionLegacy?: string | null;
    category?: string;
    count?: number;
    href?: string;
}

export interface DashboardSystemCoverage {
    materials?: number;
    suppliers?: number;
    finishGoods?: number;
    manpower?: number;
}

export interface ForecastDailyStat {
    date: string;
    count: number;
    totalQty: number;
}

export interface IncomingDailyStat {
    date: string;
    count?: number;
    totalQty: number;
}

export interface DeliveryDailyStat {
    date: string;
    totalQty: number;
}

export interface DashboardSummary {
    totalMaterials: number;
    totalSuppliers: number;
    totalFinishGoods: number;
    totalManPower: number;
    totalIncomingQty: number;
    totalDeliveryQty: number;
}

export interface DashboardData {
    meta: DashboardMeta;
    currentSnapshot: DashboardSnapshot;
    monthly: DashboardMonthly;
    daily: DashboardDailyItem[];
    releasePipeline: DashboardReleasePipelineItem[];
    inventoryRisk: DashboardInventoryRiskItem[];
    topParts: DashboardTopPartItem[];
    topSuppliers?: DashboardTopSupplierItem[];
    topIncomingMaterials?: DashboardTopIncomingMaterialItem[];
    recentIncoming?: DashboardRecentIncomingItem[];
    exceptions: DashboardExceptionItem[];
    systemCoverage?: DashboardSystemCoverage;
    summary?: DashboardSummary;
    forecastDailyStats?: ForecastDailyStat[];
    incomingDailyStats?: IncomingDailyStat[];
    deliveryDailyStats?: DeliveryDailyStat[];
    currentMonth?: string;
    daysInMonth?: number;
}

interface DashboardState {
    data: DashboardData | null;
    loading: boolean;
    error: string | null;
    errorStatus: number | null;
}

const initialState: DashboardState = {
    data: null,
    loading: false,
    error: null,
    errorStatus: null,
};

export const fetchDashboard = createAsyncThunk<
    DashboardData,
    DashboardQuery | undefined,
    { rejectValue: { message: string; status: number | null } }
>("dashboard/fetch", async (query, {rejectWithValue}) => {
    try {
        const searchParams = new URLSearchParams();
        if (query) {
            searchParams.set("month", String(query.month));
            searchParams.set("year", String(query.year));
        }
        const queryString = searchParams.toString();
        const response = await fetch(
            `/api/frontend/dashboard${queryString ? `?${queryString}` : ""}`,
            {cache: "no-store"},
        );
        const envelope = (await response.json()) as
            | ApiSuccessEnvelope<DashboardData>
            | DashboardData
            | { message?: string };
        if (!response.ok) {
            return rejectWithValue({
                message:
                    envelope && "message" in envelope && envelope.message
                        ? envelope.message
                        : "Gagal mengambil data dashboard",
                status: response.status,
            });
        }
        return typeof envelope === "object" && envelope !== null && "success" in envelope
            ? (envelope as ApiSuccessEnvelope<DashboardData>).data
            : (envelope as DashboardData);
    } catch (error: unknown) {
        return rejectWithValue({
            message: error instanceof Error ? error.message : "Gagal mengambil data dashboard",
            status: null,
        });
    }
});

const dashboardSlice = createSlice({
    name: "dashboard",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchDashboard.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.errorStatus = null;
            })
            .addCase(fetchDashboard.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload;
            })
            .addCase(fetchDashboard.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.message ?? "Gagal mengambil data dashboard";
                state.errorStatus = action.payload?.status ?? null;
            });
    },
});

export default dashboardSlice.reducer;
