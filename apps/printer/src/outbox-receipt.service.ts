/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

/** PostgreSQL is the durable send fence. Redis job completion is not delivery evidence. */
@Injectable()
export class OutboxReceiptService implements OnModuleDestroy {
  private readonly pool: Pool;
  constructor(config: ConfigService) {
    this.pool = new Pool({
      connectionString: config.getOrThrow<string>("DATABASE_URL"),
      connectionTimeoutMillis: 10000,
    });
  }
  async onModuleDestroy() {
    await this.pool.end();
  }
  async transition(
    id: string,
    attempt: number,
    from: string,
    to: "SENDING" | "SUCCEEDED" | "UNCERTAIN",
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{
        Status: string;
        Attempts: number;
        LastErrorCode: string;
      }>(
        'SELECT "Status", "Attempts", "LastErrorCode" FROM "OutboxEvent" WHERE "Id"=$1 FOR UPDATE',
        [id],
      );
      const before = result.rows[0];
      if (
        !before ||
        before.Status !== "PROCESSING" ||
        before.Attempts !== attempt ||
        before.LastErrorCode !== from
      ) {
        await client.query("ROLLBACK");
        return false;
      }
      const status =
        to === "SUCCEEDED"
          ? "SUCCEEDED"
          : to === "UNCERTAIN"
            ? "FAILED"
            : "PROCESSING";
      const code =
        to === "SUCCEEDED"
          ? "OUTBOX_TRANSPORT_ACCEPTED"
          : to === "UNCERTAIN"
            ? "OUTBOX_DELIVERY_UNCERTAIN"
            : "OUTBOX_SENDING";
      await client.query(
        'UPDATE "OutboxEvent" SET "Status"=$2::"OutboxEventStatus", "LastErrorCode"=$3, "LastError"=$4, "UpdatedAt"=clock_timestamp(), "SucceededAt"=CASE WHEN $2=\'SUCCEEDED\' THEN now() ELSE "SucceededAt" END, "FailedAt"=CASE WHEN $2=\'FAILED\' THEN now() ELSE "FailedAt" END WHERE "Id"=$1',
        [
          id,
          status,
          code,
          to === "UNCERTAIN"
            ? "Printer delivery outcome requires reconciliation."
            : null,
        ],
      );
      const processId = `PR${randomUUID().replaceAll("-", "")}`;
      await client.query(
        'INSERT INTO "LogProcess" ("ProcessId","FunctionId","FunctionName","ProcessStatus","ProcessStart","ProcessEnd","ProcessDate","CreatedAt","CreatedBy") VALUES ($1,\'OUTBOX\',\'Printer.Transport\',$2,now(),now(),now(),now(),\'SYSTEM:PRINTER\')',
        [processId, to === "UNCERTAIN" ? "FAILED" : "SUCCESS"],
      );
      await client.query(
        'INSERT INTO "LogProcessDetail" ("ProcessId","MessageId","Message","Type","Location","ProcessDate","CreatedAt") VALUES ($1,$2,$3,\'INFO\',\'Printer.OutboxReceipt\',now(),now())',
        [processId, `COMM-${randomUUID()}`, `Integration ${to}; event ${id}`],
      );
      await client.query(
        'INSERT INTO "ActionAuditEvent" ("SourceType","SourceId","Action","Actor","ActorSource","ProcessId","Before","After") VALUES (\'OutboxEvent\',$1,$2,\'SYSTEM:PRINTER\',\'SYSTEM_WORKER\',$3,$4::jsonb,$5::jsonb)',
        [
          id,
          to === "SUCCEEDED" ? "TRANSPORT_ACCEPTED" : to,
          processId,
          JSON.stringify({
            status: before.Status,
            attempts: before.Attempts,
            errorCode: before.LastErrorCode,
          }),
          JSON.stringify({ status, attempts: attempt, errorCode: code }),
        ],
      );
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
