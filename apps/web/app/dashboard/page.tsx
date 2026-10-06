/* By Irfan Akbari Vuteq Indonesia - 2026-10-06 */
import type { Metadata } from "next";
import ProductionDashboard from "./_components/ProductionDashboard";

export const metadata: Metadata = {
    title: "ANSEI | Production Control",
    description:
        "Live production release, delivery cycle and process progress for the genba.",
    robots: { index: false, follow: false },
};

export default function DashboardPage() {
    return <ProductionDashboard />;
}
