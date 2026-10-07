/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
export interface OrderCandidateIds {
  demandIds: string[];
  total: number;
}

/** Normalize the HTTP envelope before it can reach controlled selection state. */
export function parseOrderCandidateIds(response: unknown): OrderCandidateIds {
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  const payload =
    isRecord(response) && response.success === true ? response.data : response;
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.demandIds) ||
    !payload.demandIds.every(
      (id): id is string => typeof id === "string" && id.trim().length > 0,
    ) ||
    !Number.isInteger(payload.total) ||
    (payload.total as number) < 0 ||
    payload.total !== payload.demandIds.length ||
    new Set(payload.demandIds).size !== payload.demandIds.length
  ) {
    throw new Error(
      "Invalid production order selection response. Please refresh and try again.",
    );
  }
  return { demandIds: payload.demandIds, total: payload.total as number };
}
