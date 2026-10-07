/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
import { getApiUrl } from "@/lib/config";
import { normalizeNasMediaUrl } from "@/lib/nas-media-url";
import { sso } from "@/lib/sso";

const PHOTO_BASE = "http://192.168.1.15:8080/Ansei_Asset/manpower/";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

type ManPowerPhoto = { PicturePath?: unknown };

async function isActivePhoto(
  request: Request,
  photoUrl: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `${getApiUrl("v1", request)}/frontend/man-power`,
      {
        cache: "no-store",
      },
    );
    if (!response.ok) return false;
    const body: unknown = await response.json();
    const rows = Array.isArray(body)
      ? body
      : body &&
          typeof body === "object" &&
          "data" in body &&
          Array.isArray(body.data)
        ? body.data
        : [];
    return rows.some(
      (row: ManPowerPhoto) =>
        typeof row?.PicturePath === "string" &&
        normalizeNasMediaUrl(row.PicturePath) === photoUrl,
    );
  } catch {
    return false;
  }
}

async function canReadManPower(request: Request): Promise<boolean> {
  try {
    if (!(await sso.session(request))) return false;
    const response = await sso.fetch(
      request,
      new URL(`${getApiUrl("v1", request)}/master/man-power?page=1&limit=1`),
      { cache: "no-store" },
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ file: string }> },
) {
  const { file } = await context.params;
  if (!/^[A-Za-z0-9_-]+\.(?:jpe?g|png|gif|webp)$/i.test(file)) {
    return new Response(null, { status: 404 });
  }

  const photoUrl = `${PHOTO_BASE}${file}`;
  if (
    !(await isActivePhoto(request, photoUrl)) &&
    !(await canReadManPower(request))
  ) {
    return new Response(null, { status: 404 });
  }

  try {
    const upstream = await fetch(photoUrl, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) return new Response(null, { status: 404 });
    const contentType = upstream.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();
    const contentLength = Number(upstream.headers.get("content-length"));
    if (
      !contentType ||
      !IMAGE_TYPES.has(contentType) ||
      (Number.isFinite(contentLength) && contentLength > MAX_PHOTO_BYTES)
    ) {
      return new Response(null, { status: 502 });
    }
    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > MAX_PHOTO_BYTES)
      return new Response(null, { status: 502 });
    return new Response(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
