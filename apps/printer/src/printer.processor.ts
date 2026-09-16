import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { PartTagPdfService } from "./part-tag-pdf.service";
import { IpPrinterService } from "./ip-printer.service";
import { PrinterSettingService } from "./printer-setting.service";

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
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === "printPartTagAnsei") {
      const data = job.data as PartTagAnseiPayload;

      let printerIp = data.printerIp;
      if (!printerIp) {
        printerIp = await this.printerSettingService.getActivePrinterIp();
      }
      if (!printerIp) {
        printerIp = process.env.PRINTER_DEFAULT_IP || "127.0.0.1";
      }

      this.logger.log(
        `Processing print job for PO ${data.poNumber} on IP ${printerIp}`,
      );

      try {
        const pdfBuffer = await this.pdfService.generatePartTagPdf(data);

        await this.printerService.printPdf(
          pdfBuffer,
          printerIp,
          `ANSEI_PartTag_${data.poId}`,
        );

        this.logger.log(`Successfully printed job ${job.id} to ${printerIp}`);
      } catch (error) {
        this.logger.error(
          `Error processing print job ${job.id}: ${error.message}`,
          error.stack,
        );
        throw error;
      }
    } else {
      this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }
}
