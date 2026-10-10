/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
export function sapAttention(error: string | null, status?: string) {
  if (status === "SYNCED" || status === "CANCELLED" || !error) return null;
  if (/sync is paused/i.test(error))
    return {
      cause: "SAP sync is paused",
      action:
        "The queue resumes automatically when synchronization is enabled.",
    };
  if (/posting is disabled/i.test(error))
    return {
      cause: "SAP posting is off",
      action: "Enable posting, then retry.",
    };
  if (/posting period locked|-4013/i.test(error))
    return {
      cause: "Posting period was locked",
      action: "Open the posting period in SAP, then retry.",
    };
  if (/project code is mandatory/i.test(error))
    return {
      cause: "Project Code is missing",
      action: "Set the correct SAP project mapping, then retry.",
    };
  if (
    status === "RECONCILE" ||
    /outcome unknown|outcome is unknown/i.test(error)
  )
    return {
      cause: "SAP result is unconfirmed",
      action: "Use Check SAP Result before retrying.",
    };
  if (/Zero-price STO surplus is disabled/i.test(error))
    return {
      cause: "SAP does not yet allow STO surplus at zero price",
      action:
        "Enable Allow Inbound Posting with Zero Price in SAP Document Settings, then retry. Do not assign an artificial material cost.",
    };
  if (/zero inventory cost/i.test(error))
    return {
      cause: "Customer-owned inventory has a nonzero SAP cost",
      action:
        "Review the SAP item valuation. Keep the FG service price separate from inventory cost.",
    };
  if (/HTTP 400/i.test(error))
    return {
      cause: "SAP rejected the request",
      action:
        "Detailed reason was not recorded. Ask an administrator to investigate before retrying.",
    };
  if (/unavailable before confirmed delivery/i.test(error))
    return {
      cause: "SAP could not be reached",
      action:
        "Automatic retry is scheduled. Check the connection if this continues.",
    };
  if (/^Waiting for/i.test(error))
    return { cause: "Waiting for a related SAP transaction", action: error };
  return { cause: "Transaction needs attention", action: error };
}
