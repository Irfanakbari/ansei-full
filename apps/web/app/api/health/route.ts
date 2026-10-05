/* By Irfan Akbari Vuteq Indonesia - 2026-10-05 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ service: "ansei-web", status: "ok", time: new Date().toISOString() });
}
