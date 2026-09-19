/*By Irfan Akbari Vuteq Indonesia - 2026-09-18*/
export const MAX_PRODUCTION_MINUTES = 2147483647;

export function formatProductionDuration(minutes: number | null | undefined): string {
    if (minutes == null) return 'Not recorded';
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}
