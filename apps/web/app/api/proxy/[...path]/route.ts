/*By Irfan Akbari Vuteq Indonesia - 2026-09-09*/

import { NextRequest, NextResponse } from "next/server";
import { type ApiVersion, getApiUrl } from "@/lib/config";
import { sso } from "@/lib/sso";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const API_VERSION_PATTERN = /^v\d+$/;

async function handler(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  if (!ALLOWED_METHODS.has(request.method)) {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 },
    );
  }

  const { path } = await context.params;
  const [version, ...segments] = path;
  if (!version || !API_VERSION_PATTERN.test(version) || segments.length === 0) {
    return NextResponse.json({ message: "Invalid API path" }, { status: 400 });
  }

  const backendUrl = new URL(
    `${getApiUrl(version as ApiVersion)}/${segments.map(encodeURIComponent).join("/")}`,
  );
  backendUrl.search = request.nextUrl.search;

  const headers = new Headers();
  const incomingRequestId = request.headers.get("x-request-id");
  const requestId =
    incomingRequestId && /^[A-Za-z0-9._:-]{1,128}$/.test(incomingRequestId)
      ? incomingRequestId
      : crypto.randomUUID();
  headers.set("x-request-id", requestId);
  const commandId = request.headers.get('idempotency-key');
  if (commandId && /^[0-9a-f-]{36}$/i.test(commandId)) headers.set('idempotency-key', commandId);
  const contentType = request.headers.get("content-type");
  const accept = request.headers.get("accept");

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (accept) {
    headers.set("accept", accept);
  }

  const body =
    request.method === "GET" ? undefined : await request.arrayBuffer();
  let response: Response;
  try {
    response = await sso.fetch(request, backendUrl, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
    });
  } catch (error: any) {
    if (error?.name === "VuteqAuthenticationError") {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 },
      );
    }

    process.stderr.write(
      `${JSON.stringify({
        level: "error",
        event: "api_proxy_backend_unavailable",
        requestId,
        method: request.method,
        path: `/${segments.join("/")}`,
        backendHost: backendUrl.host,
        error: error?.message || "Unknown error",
      })}\n`,
    );

    return NextResponse.json(
      { message: "Backend service is unavailable" },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("set-cookie");

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
