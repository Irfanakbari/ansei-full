/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { redirect } from "next/navigation";
import { withBasePath } from "@/lib/base-path";
export default function Page() {
  redirect(withBasePath("/apps/sap-connection/overview"));
}
