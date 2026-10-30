/* By Irfan Akbari Vuteq Indonesia - 2026-10-29 */
export const dynamic = "force-dynamic";

export function GET() {
  const isDemo =
    Reflect.get(process.env, "DEMO") === "true" ||
    Reflect.get(process.env, "NEXT_PUBLIC_DEMO") === "true";
  return Response.json(
    { demo: isDemo },
    { headers: { "Cache-Control": "no-store" } },
  );
}
