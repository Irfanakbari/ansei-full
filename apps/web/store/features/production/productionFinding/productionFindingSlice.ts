/* By Irfan Akbari Vuteq Indonesia - 2026-09-29 */

import {createAsyncThunk, createSlice} from "@reduxjs/toolkit";
import {withBasePath} from "@/lib/base-path";
import {del, get, getApiErrorMessage, post, type ApiSuccessEnvelope} from "@/store/utils/apiService";

export type FindingCategory = "MATERIAL" | "FINISH_GOOD";
export type FindingStatus = "PENDING" | "WAITING_PART_CHANGE" | "COMPLETED" | "REJECTED";

export interface FindingAllocation {
    Id: string;
    ShoppingId: string;
    Qty: number;
    Shopping: {Id: string; MaterialId: string; QtyPick: number; Description: string | null};
}

export interface FindingComponent {
    Id: string;
    SnapshotLineId: string;
    MaterialId: string;
    Qty: number;
    SnapshotLine: {Id: string; PartNumber: string; PartName: string; UnitName: string | null};
    Allocations: FindingAllocation[];
}

export interface ProductionFinding {
    Id: string;
    RecordNumber: string;
    Category: FindingCategory;
    Status: FindingStatus;
    Location: "WAREHOUSE" | "RACK" | "ASSY" | "FINISH_GOOD_AREA" | null;
    MaterialId: string | null;
    Qty: number;
    Reason: string;
    Reporter: string;
    SubmittedAt: string;
    ReviewedBy: string | null;
    ReviewedAt: string | null;
    ReviewNote: string | null;
    CompletedBy: string | null;
    CompletedAt: string | null;
    Material: {PartNumber: string; PartName: string} | null;
    Forecast: {PoId: string; PoNumber: string; FinishGoodId: string} | null;
    Release: {Id: string; ReleaseNumber: string} | null;
    Label: {Id: number; LabelNumber: string} | null;
    Components: FindingComponent[];
    Events: {Id: string; Type: string; Actor: string; Metadata: unknown; CreatedAt: string}[];
}

export interface FindingPage {
    data: ProductionFinding[];
    meta: {page: number; limit: number; totalItems: number; totalPages: number};
}

export interface DisplayLabelInspection {
    label: {Id: number; LabelNumber: string; QtyThisBox: number; ForecastId: string; PartData?: {PartName: string}};
    status: string;
}

export interface FinishGoodFindingContext {
    labelNumber: string;
    finishGoodPartNumber: string;
    finishGoodPartName: string;
    labelQty: number;
    components: {
        snapshotLineId: string;
        materialPartNumber: string;
        materialPartName: string;
        QtyPerUnit: number;
    }[];
}

export interface PublicMaterialFindingOption {
    partNumber: string;
    partName: string;
}

export interface PublicLabelFindingOption {
    labelNumber: string;
    labelQty: number;
    finishGoodPartNumber: string;
    finishGoodPartName: string;
}

export interface PublicFindingOptionsQuery {
    search?: string;
    limit?: number;
}

const payload = <T,>(value: T | ApiSuccessEnvelope<T>): T =>
    typeof value === "object" && value !== null && "data" in value ? value.data : value;

async function publicRequest<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(withBasePath(path), {cache: "no-store", ...options});
    const body: unknown = await response.json();
    if (!response.ok) {
        const message = typeof body === "object" && body !== null && "message" in body && typeof body.message === "string"
            ? body.message
            : "Request failed";
        throw new Error(message);
    }
    return payload(body as T | ApiSuccessEnvelope<T>);
}

const publicOptionsQuery = ({search, limit}: PublicFindingOptionsQuery) => {
    const query = new URLSearchParams();
    if (search?.trim()) query.set("search", search.trim());
    if (limit) query.set("limit", String(limit));
    return query.size ? `?${query.toString()}` : "";
};

export const fetchPublicMaterialFindingOptions = createAsyncThunk<PublicMaterialFindingOption[], PublicFindingOptionsQuery, {rejectValue: string}>(
    "productionFindings/publicMaterialOptions", async (query, {rejectWithValue}) => {
        try {
            return await publicRequest<PublicMaterialFindingOption[]>(`/api/display/production-findings/material-options${publicOptionsQuery(query)}`);
        } catch (error) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to load material options"));
        }
    },
);

export const fetchPublicLabelFindingOptions = createAsyncThunk<PublicLabelFindingOption[], PublicFindingOptionsQuery, {rejectValue: string}>(
    "productionFindings/publicLabelOptions", async (query, {rejectWithValue}) => {
        try {
            return await publicRequest<PublicLabelFindingOption[]>(`/api/display/production-findings/label-options${publicOptionsQuery(query)}`);
        } catch (error) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to load label options"));
        }
    },
);

export const submitMaterialFinding = createAsyncThunk<ProductionFinding, {
    requestId: string; materialId: string; location: "WAREHOUSE" | "RACK" | "ASSY"; qty: number; reason: string; reporter: string;
}, {rejectValue: string}>("productionFindings/submitMaterial", async (body, {rejectWithValue}) => {
    try {
        return await publicRequest<ProductionFinding>("/api/display/production-findings/material", {
            method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body),
        });
    } catch (error) {
        return rejectWithValue(getApiErrorMessage(error, "Failed to submit material finding"));
    }
});

export const fetchFinishGoodFindingContext = createAsyncThunk<FinishGoodFindingContext, string, {rejectValue: string}>(
    "productionFindings/fetchFinishGoodContext", async (labelNumber, {rejectWithValue}) => {
        try {
            const query = new URLSearchParams({labelNumber});
            return await publicRequest<FinishGoodFindingContext>(`/api/display/production-findings/finish-good?${query.toString()}`);
        } catch (error) {
            return rejectWithValue(getApiErrorMessage(error, "Failed to load finish-good finding context"));
        }
    },
);

export const submitFinishGoodFinding = createAsyncThunk<ProductionFinding, {
    requestId: string; labelNumber: string; qty: number; reason: string; reporter: string;
    components: {snapshotLineId: string; qty: number}[];
}, {rejectValue: string}>("productionFindings/submitFinishGood", async (body, {rejectWithValue}) => {
    try {
        return await publicRequest<ProductionFinding>("/api/display/production-findings/finish-good", {
            method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body),
        });
    } catch (error) {
        return rejectWithValue(getApiErrorMessage(error, "Failed to submit finish-good finding"));
    }
});

export const fetchFindings = createAsyncThunk<FindingPage, {
    page?: number; limit?: number; search?: string; category?: FindingCategory; status?: FindingStatus;
}, {rejectValue: string}>("productionFindings/list", async (query, {rejectWithValue}) => {
    try {
        const response = await get<ApiSuccessEnvelope<ProductionFinding[]> & {meta: FindingPage["meta"]}>(
            "/production/findings", {params: query},
        );
        return {data: response.data, meta: response.meta};
    } catch (error) {
        return rejectWithValue(getApiErrorMessage(error, "Failed to load production findings"));
    }
});

export const fetchFinding = createAsyncThunk<ProductionFinding, string, {rejectValue: string}>(
    "productionFindings/detail", async (id, {rejectWithValue}) => {
        try { return (await get<ApiSuccessEnvelope<ProductionFinding>>(`/production/findings/${id}`)).data; }
        catch (error) { return rejectWithValue(getApiErrorMessage(error)); }
    },
);

type FindingCommand = {id: string; requestId: string; note?: string};
const command = (name: string, action: string) => createAsyncThunk<ProductionFinding, FindingCommand, {rejectValue: string}>(
    `productionFindings/${name}`, async ({id, ...body}, {rejectWithValue}) => {
        try { return (await post<ApiSuccessEnvelope<ProductionFinding>>(`/production/findings/${id}/${action}`, body)).data; }
        catch (error) { return rejectWithValue(getApiErrorMessage(error)); }
    },
);
export const approveFinding = command("approve", "approve");
export const rejectFinding = command("reject", "reject");
export const completeFinding = command("complete", "complete");
export const deleteFinding = createAsyncThunk<ProductionFinding, FindingCommand & {note: string}, {rejectValue: string}>(
    "productionFindings/delete", async ({id, ...body}, {rejectWithValue}) => {
        try { return (await del<ApiSuccessEnvelope<ProductionFinding>>(`/production/findings/${id}`, {body})).data; }
        catch (error) { return rejectWithValue(getApiErrorMessage(error)); }
    },
);
export const allocateFinding = createAsyncThunk<ProductionFinding, FindingCommand & {componentId: string; shoppingId: string; qty: number}, {rejectValue: string}>(
    "productionFindings/allocate", async ({id, ...body}, {rejectWithValue}) => {
        try { return (await post<ApiSuccessEnvelope<ProductionFinding>>(`/production/findings/${id}/allocations`, body)).data; }
        catch (error) { return rejectWithValue(getApiErrorMessage(error)); }
    },
);

const productionFindingSlice = createSlice({
    name: "productionFindings",
    initialState: {submitting: false},
    reducers: {},
    extraReducers: (builder) => builder
        .addCase(submitMaterialFinding.pending, (state) => { state.submitting = true; })
        .addCase(submitMaterialFinding.fulfilled, (state) => { state.submitting = false; })
        .addCase(submitMaterialFinding.rejected, (state) => { state.submitting = false; }),
});

export default productionFindingSlice.reducer;
