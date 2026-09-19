/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { PartTagPdfService } from "./part-tag-pdf.service";
import { IpPrinterService } from "./ip-printer.service";
import { PrinterSettingService } from "./printer-setting.service";
import { OutboxReceiptService } from "./outbox-receipt.service";
export interface PartTagAnseiPayload {
  poId: string;
  qtyOrder: number;
  partNumber: string;
  partName: string;
  vendorCode: string;
  classificationCode: string;
  deliveryDate: string | Date;
  qtyPerbox: number;
  poNumber: string;
  receivingArea: string;
  printerIp?: string;
  outboxEventId?: string;
  outboxAttempt?: number;
}
@Processor("printer_queue")
export class PrinterProcessor extends WorkerHost {
  private readonly logger = new Logger(PrinterProcessor.name);
  constructor(
    private readonly pdfService: PartTagPdfService,
    private readonly printerService: IpPrinterService,
    private readonly printerSettingService: PrinterSettingService,
    private readonly receipts: OutboxReceiptService,
  ) {
    super();
  }
  async process(job: Job<PartTagAnseiPayload>): Promise<void> {
    if (job.name !== "printPartTagAnsei")
      throw new Error("Unsupported printer job");
    const data = job.data;
    // Old/untracked jobs must be reconciled at cutover; never bypass the durable fence.
    if (!data.outboxEventId || !Number.isInteger(data.outboxAttempt))
      throw new Error("Tracked outbox identity required");
    const attempt = data.outboxAttempt;
    const printerIp =
      data.printerIp ||
      (await this.printerSettingService.getActivePrinterIp()) ||
      process.env.PRINTER_DEFAULT_IP;
    if (!printerIp) throw new Error("Printer configuration unavailable");
    const pdfBuffer = await this.pdfService.generatePartTagPdf(data);
    const claimed = await this.receipts.transition(
      data.outboxEventId,
      attempt,
      "OUTBOX_PRINT_READY",
      "SENDING",
    );
    if (!claimed) return;
    try {
      await this.printerService.printPdf(
        pdfBuffer,
        printerIp,
        `ANSEI_${job.id}`,
      );
      await this.receipts.transition(
        data.outboxEventId,
        attempt,
        "OUTBOX_SENDING",
        "SUCCEEDED",
      );
    } catch {
      await this.receipts.transition(
        data.outboxEventId,
        attempt,
        "OUTBOX_SENDING",
        "UNCERTAIN",
      );
      this.logger.error(
        "Printer transport outcome requires reconciliation. See Integration Monitor.",
      );
      throw new Error("Printer transport outcome uncertain");
    }
  }
}
