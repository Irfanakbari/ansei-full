/* By Irfan Akbari Vuteq Indonesia - 2026-09-29 */

import {NextResponse} from "next/server";
import {getApiUrl} from "@/lib/config";

export async function POST(request: Request) {
    try {
        const body: unknown = await request.json();
        const response = await fetch(`${getApiUrl("v1", request)}/production/findings/public/material`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(body),
            cache: "no-store",
        });
        const data: unknown = await response.json();
        return NextResponse.json(data, {status: response.status});
    } catch {
        return NextResponse.json({message: "Production finding service is unavailable"}, {status: 502});
    }
}
