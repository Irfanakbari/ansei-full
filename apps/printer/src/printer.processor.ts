import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { PartTagPdfService } from "./part-tag-pdf.service";
import { IpPrinterService } from "./ip-printer.service";
import { PrinterSettingService } from "./printer-setting.service";
import { PrinterErrorFileLogService } from "./printer-error-file-log.service";

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
}

@Processor("printer_queue")
export class PrinterProcessor extends WorkerHost {
  private readonly logger = new Logger(PrinterProcessor.name);

  constructor(
    private readonly pdfService: PartTagPdfService,
    private readonly printerService: IpPrinterService,
    private readonly printerSettingService: PrinterSettingService,
    private readonly fileLogger: PrinterErrorFileLogService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === "printPartTagAnsei") {
      const data = job.data as PartTagAnseiPayload;
      const jobId = job.id ? String(job.id) : "unknown";
      const attempt = (job.attemptsMade ?? 0) + 1;
      const maxAttempts = job.opts?.attempts ?? 1;
      const startTime = Date.now();

      let printerIp = data.printerIp;
      if (!printerIp) {
        printerIp = await this.printerSettingService.getActivePrinterIp();
      }
      if (!printerIp) {
        printerIp = process.env.PRINTER_DEFAULT_IP || "127.0.0.1";
      }

      this.logger.log(
        `[Job #${jobId}] Memulai proses pencetakan Part Tag (Percobaan ${attempt}/${maxAttempts}): ` +
          `PO ID=${data.poId}, PO Number=${data.poNumber}, Part=${data.partNumber} (${data.partName || "-"}), ` +
          `Order Qty=${data.qtyOrder}, Target IP=${printerIp}`,
      );

      try {
        const pdfBuffer = await this.pdfService.generatePartTagPdf(data);

        await this.printerService.printPdf(
          pdfBuffer,
          printerIp,
          `ANSEI_PartTag_${data.poId}`,
        );

        const durationMs = Date.now() - startTime;
        this.logger.log(
          `[Job #${jobId} SUCCESS] Berhasil mencetak Part Tag untuk PO ${data.poNumber} ke printer ${printerIp} (${durationMs}ms)`,
        );
      } catch (error) {
        const durationMs = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        this.logger.error(
          `[Job #${jobId} FAILED] Gagal memproses pencetakan Part Tag untuk PO ${data.poNumber} ke printer ${printerIp} (${durationMs}ms).\n` +
            `Detail Error: ${errorMessage}\n` +
            `Parameter: PO ID=${data.poId}, PO Number=${data.poNumber}, Part=${data.partNumber}, QtyOrder=${data.qtyOrder}, QtyPerBox=${data.qtyPerbox}, Target IP=${printerIp}`,
          error instanceof Error ? error.stack : undefined,
        );

        // Record error to Winston daily rotated file log
        await this.fileLogger.write(error, {
          jobId,
          jobName: job.name,
          poId: data.poId,
          poNumber: data.poNumber,
          partNumber: data.partNumber,
          partName: data.partName,
          qtyOrder: data.qtyOrder,
          qtyPerbox: data.qtyPerbox,
          printerIp,
          attemptsMade: attempt,
          maxAttempts,
          durationMs,
        });

        throw error;
      }
    } else {
      this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }
}
