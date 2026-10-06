/* By Irfan Akbari Vuteq Indonesia - 2026-10-06 */
import { NextResponse } from "next/server";
import { getApiUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const response = await fetch(
            `${getApiUrl("v1")}/frontend/production-dashboard`,
            {
                cache: "no-store",
                signal: AbortSignal.timeout(12000),
            },
        );
        if (!response.ok) {
            return NextResponse.json(
                { message: "Production data is temporarily unavailable" },
                { status: 503, headers: { "Cache-Control": "no-store" } },
            );
        }
        const data: unknown = await response.json();
        return NextResponse.json(data, {
            headers: { "Cache-Control": "no-store" },
        });
    } catch {
        return NextResponse.json(
            { message: "Production data is temporarily unavailable" },
            { status: 503, headers: { "Cache-Control": "no-store" } },
        );
    }
}
