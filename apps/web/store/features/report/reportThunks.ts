/* By Irfan Akbari Vuteq Indonesia - 2026-10-10 */
import { createAsyncThunk } from "@reduxjs/toolkit";
import { fetchWithAuth } from "@/store/utils/fetchWithAuth";

export interface DownloadReportArgs {
  key: string;
  filename: string;
  fromdate?: string;
  todate?: string;
  category?: string;
  location?: string;
  month?: string;
}

export const downloadReport = createAsyncThunk<
  void,
  DownloadReportArgs,
  { rejectValue: string }
>(
  "report/download",
  async (
    { key, filename: fallbackFilename, ...query },
    { rejectWithValue },
  ) => {
    try {
      const params = new URLSearchParams();
      for (const [name, value] of Object.entries(query))
        if (value) params.set(name, value);
      const response = await fetchWithAuth(
        `/api/proxy/v1/report/${encodeURIComponent(key)}?${params}`,
        { method: "GET" },
      );
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          body && typeof body === "object" && "message" in body
            ? body.message
            : undefined;
        throw new Error(
          typeof message === "string"
            ? message
            : Array.isArray(message) &&
                message.every((item) => typeof item === "string")
              ? message.join("; ")
              : "Failed to download report",
        );
      }
      const disposition = response.headers.get("Content-Disposition");
      const filename =
        disposition?.match(/filename="?([^";]+)"?/i)?.[1] ?? fallbackFilename;
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      try {
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error: unknown) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to download report",
      );
    }
  },
);
