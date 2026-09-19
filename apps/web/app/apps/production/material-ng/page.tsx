import { Suspense } from "react";
import MaterialNgWorkspace from "../shopping/_components/MaterialNgWorkspace";

export default function MaterialNgPage() {
  return (
    <Suspense fallback={<p>Loading material NG…</p>}>
      <MaterialNgWorkspace />
    </Suspense>
  );
}
