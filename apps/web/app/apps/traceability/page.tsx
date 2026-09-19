/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { Suspense } from "react";
import TraceabilityView from "./_components/TraceabilityView";
export default function TraceabilityPage() {
  return (
    <Suspense fallback={<p>Loading traceability…</p>}>
      <TraceabilityView />
    </Suspense>
  );
}
