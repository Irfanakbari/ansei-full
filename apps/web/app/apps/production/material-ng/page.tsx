/* By Irfan Akbari Vuteq Indonesia - 2026-09-29 */
"use client";

import { Alert, Breadcrumb, Card } from "antd";
import ProductionFindingQueue from "./_components/ProductionFindingQueue";
import { usePhasePermission } from "@/components/traceability/usePhasePermission";

export default function MaterialNgPage() {
  const { can } = usePhasePermission();

  return (
    <Card variant="borderless" styles={{ body: { padding: 0 } }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: "Home" },
          { title: "Production" },
          { title: "Process" },
          { title: "NG Report" },
        ]}
      />
      {can("IPCS.MATERIAL_NG_REVIEW") ? (
        <ProductionFindingQueue />
      ) : (
        <Alert
          type="error"
          showIcon
          title="IPCS.MATERIAL_NG_REVIEW permission is required"
        />
      )}
    </Card>
  );
}
