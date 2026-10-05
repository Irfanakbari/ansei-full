/* By Irfan Akbari Vuteq Indonesia - 2026-10-05 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/ansei";

export function withBasePath(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (
    !BASE_PATH ||
    normalizedPath === BASE_PATH ||
    normalizedPath.startsWith(`${BASE_PATH}/`)
  ) {
    return normalizedPath;
  }

  return `${BASE_PATH}${normalizedPath}`;
}

export function withoutBasePath(pathname: string): string {
  if (!BASE_PATH) return pathname;
  if (pathname === BASE_PATH) return "/";
  if (pathname.startsWith(`${BASE_PATH}/`)) return pathname.slice(BASE_PATH.length);
  return pathname;
}
