/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { Suspense } from "react";
import MaterialNgWorkspace from "../_components/MaterialNgWorkspace";
export default function MaterialNgPage() {
  return (
    <Suspense fallback={<p>Loading material NG…</p>}>
      <MaterialNgWorkspace />
    </Suspense>
  );
}
