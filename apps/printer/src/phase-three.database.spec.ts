/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { OutboxReceiptService } from "./outbox-receipt.service";
import { PrinterProcessor } from "./printer.processor";
const suite =
  process.env.PHASE3_DATABASE_TEST === "1" ? describe : describe.skip;
suite("Printer durable PostgreSQL receipts", () => {
  let db: Pool;
  let receipts: OutboxReceiptService;
  const create = async () => {
    const id = randomUUID();
    await db.query(
      'INSERT INTO "OutboxEvent" ("Id","IdempotencyKey","Type","Payload","Status","Attempts","LastErrorCode","UpdatedAt") VALUES ($1::text,$1::text,\'PRINT_PART_TAG_ANSEI\',\'{}\',\'PROCESSING\',1,\'OUTBOX_PRINT_READY\',now())',
      [id],
    );
    return id;
  };
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL);
    if (
      url.hostname !== "127.0.0.1" ||
      url.port !== "56835" ||
      url.pathname !== "/ansei_phase3"
    )
      throw new Error("Disposable phase3 database required");
    db = new Pool({ connectionString: process.env.DATABASE_URL });
    receipts = new OutboxReceiptService(
      new ConfigService({ DATABASE_URL: process.env.DATABASE_URL }),
    );
  });
  afterAll(async () => {
    await receipts.onModuleDestroy();
    await db.end();
  });
  it("two workers competing for the same event send once and persist audited transport success", async () => {
    const id = await create();
    const transport = { printPdf: jest.fn().mockResolvedValue(undefined) };
    const worker = new PrinterProcessor(
      {
        generatePartTagPdf: () => Promise.resolve(Buffer.from("test")),
      } as never,
      transport as never,
      { getActivePrinterIp: () => Promise.resolve("127.0.0.1") } as never,
      receipts,
    );
    const job = {
      id: `${id}-1`,
      name: "printPartTagAnsei",
      data: { outboxEventId: id, outboxAttempt: 1 },
    };
    await Promise.all([
      worker.process(job as never),
      worker.process(job as never),
    ]);
    expect(transport.printPdf).toHaveBeenCalledTimes(1);
    const row = (
      await db.query(
        'SELECT "Status","SucceededAt" FROM "OutboxEvent" WHERE "Id"=$1',
        [id],
      )
    ).rows[0];
    expect(row.Status).toBe("SUCCEEDED");
    expect(row.SucceededAt).toBeTruthy();
    const audit = (
      await db.query(
        'SELECT "Action","ProcessId","Actor" FROM "ActionAuditEvent" WHERE "SourceId"=$1',
        [id],
      )
    ).rows;
    expect(audit).toHaveLength(2);
    expect(
      audit.every((row) => row.ProcessId && row.Actor === "SYSTEM:PRINTER"),
    ).toBe(true);
    await expect(
      db.query('DELETE FROM "ActionAuditEvent" WHERE "SourceId"=$1', [id]),
    ).rejects.toThrow();
  });
  it("blocks a crashed worker replay after the durable external-send boundary", async () => {
    const id = await create();
    expect(
      await receipts.transition(id, 1, "OUTBOX_PRINT_READY", "SENDING"),
    ).toBe(true);
    expect(
      await receipts.transition(id, 1, "OUTBOX_PRINT_READY", "SENDING"),
    ).toBe(false);
    expect(
      (
        await db.query(
          'SELECT "LastErrorCode" FROM "OutboxEvent" WHERE "Id"=$1',
          [id],
        )
      ).rows[0].LastErrorCode,
    ).toBe("OUTBOX_SENDING");
  });
  it("does not allow an old receipt to complete a newer recovery attempt", async () => {
    const id = await create();
    await db.query('UPDATE "OutboxEvent" SET "Attempts"=2 WHERE "Id"=$1', [id]);
    expect(
      await receipts.transition(id, 1, "OUTBOX_PRINT_READY", "SENDING"),
    ).toBe(false);
    expect(
      await receipts.transition(id, 2, "OUTBOX_PRINT_READY", "SENDING"),
    ).toBe(true);
  });
  it("records uncertain transport failure without repeating physical output", async () => {
    const id = await create();
    const transport = {
      printPdf: jest
        .fn()
        .mockRejectedValue(new Error("connection lost after send")),
    };
    const worker = new PrinterProcessor(
      {
        generatePartTagPdf: () => Promise.resolve(Buffer.from("test")),
      } as never,
      transport as never,
      { getActivePrinterIp: () => Promise.resolve("127.0.0.1") } as never,
      receipts,
    );
    const job = {
      id: `${id}-1`,
      name: "printPartTagAnsei",
      data: { outboxEventId: id, outboxAttempt: 1 },
    };
    await expect(worker.process(job as never)).rejects.toThrow("uncertain");
    await worker.process(job as never);
    expect(transport.printPdf).toHaveBeenCalledTimes(1);
    expect(
      (
        await db.query(
          'SELECT "LastErrorCode" FROM "OutboxEvent" WHERE "Id"=$1',
          [id],
        )
      ).rows[0].LastErrorCode,
    ).toBe("OUTBOX_DELIVERY_UNCERTAIN");
  });
});
