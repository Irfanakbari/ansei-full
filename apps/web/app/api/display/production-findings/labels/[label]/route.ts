/* By Irfan Akbari Vuteq Indonesia - 2026-09-29 */

import {NextResponse} from "next/server";
import {getApiUrl} from "@/lib/config";

export async function GET(request: Request, context: {params: Promise<{label: string}>}) {
    try {
        const {label} = await context.params;
        const response = await fetch(`${getApiUrl("v1", request)}/display/assembly/labels/${encodeURIComponent(label)}`, {cache: "no-store"});
        const data: unknown = await response.json();
        return NextResponse.json(data, {status: response.status});
    } catch {
        return NextResponse.json({message: "Label inspection service is unavailable"}, {status: 502});
    }
}
