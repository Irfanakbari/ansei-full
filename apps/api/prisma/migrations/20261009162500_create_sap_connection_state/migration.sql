CREATE TABLE IF NOT EXISTS "SapConnectionState" (
  "Company" TEXT PRIMARY KEY,
  "CheckedAt" TIMESTAMP(3),
  "Connected" BOOLEAN NOT NULL DEFAULT false,
  "RefreshStartedAt" TIMESTAMP(3),
  "RefreshedAt" TIMESTAMP(3),
  "RefreshError" TEXT,
  "WorkerAt" TIMESTAMP(3)
);
