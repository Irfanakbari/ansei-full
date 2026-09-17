CREATE TYPE "OutboxEventType" AS ENUM ('PRINT_PART_TAG_ANSEI', 'DELIVERY_NOTE_EMAIL');

CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "OutboxEvent" (
    "Id" TEXT NOT NULL,
    "IdempotencyKey" VARCHAR(255) NOT NULL,
    "Type" "OutboxEventType" NOT NULL,
    "Payload" JSONB NOT NULL,
    "Status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "Attempts" INTEGER NOT NULL DEFAULT 0,
    "MaxAttempts" INTEGER NOT NULL DEFAULT 5,
    "NextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "LastErrorCode" VARCHAR(64),
    "LastError" VARCHAR(500),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "QueuedAt" TIMESTAMP(3),
    "ProcessingAt" TIMESTAMP(3),
    "SucceededAt" TIMESTAMP(3),
    "FailedAt" TIMESTAMP(3),
    "Actor" VARCHAR(255),
    "ReferenceType" VARCHAR(64),
    "ReferenceId" VARCHAR(255),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("Id")
);

CREATE UNIQUE INDEX "OutboxEvent_IdempotencyKey_key" ON "OutboxEvent"("IdempotencyKey");
CREATE INDEX "OutboxEvent_Status_NextAttemptAt_idx" ON "OutboxEvent"("Status", "NextAttemptAt");
CREATE INDEX "OutboxEvent_ReferenceType_ReferenceId_CreatedAt_idx" ON "OutboxEvent"("ReferenceType", "ReferenceId", "CreatedAt");
