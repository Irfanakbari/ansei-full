/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
export function usePhasePermission() {
  const user = useSelector((s: RootState) => s.auth.user);
  const can = (permission: string) =>
    Boolean(
      user?.RoleName === "SUPER" ||
      user?.GlobalRoles?.includes("SUPER_ADMINISTRATOR") ||
      user?.Permission.some((p) => p === "SUPER" || p === permission),
    );
  return { can, actor: user?.UserId };
}
