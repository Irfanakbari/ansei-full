/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
import { withBasePath } from "@/lib/base-path";

const LEGACY_NAS_ORIGIN = "http://192.168.1.15";
const LEGACY_NAS_PREFIX = "/AssetStorage/Ansei_Asset/";
const PUBLIC_NAS_BASE = "http://192.168.1.15:8080/Ansei_Asset/";

export function normalizeNasMediaUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (
      url.origin !== LEGACY_NAS_ORIGIN ||
      url.username ||
      url.password ||
      !url.pathname.startsWith(LEGACY_NAS_PREFIX)
    ) {
      return value;
    }

    const relativePath = url.pathname.slice(LEGACY_NAS_PREFIX.length);
    if (!relativePath) return value;
    return `${PUBLIC_NAS_BASE}${relativePath}${url.search}${url.hash}`;
  } catch {
    return value;
  }
}

export function toBrowserManPowerPhotoUrl(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeNasMediaUrl(value);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    const prefix = "/Ansei_Asset/manpower/";
    if (
      url.origin !== new URL(PUBLIC_NAS_BASE).origin ||
      !url.pathname.startsWith(prefix) ||
      url.search ||
      url.hash
    ) {
      return normalized;
    }

    const fileName = url.pathname.slice(prefix.length);
    if (!/^[A-Za-z0-9_-]+\.(?:jpe?g|png|gif|webp)$/i.test(fileName)) {
      return normalized;
    }
    return withBasePath(`/api/manpower-photo/${fileName}`);
  } catch {
    return normalized;
  }
}
