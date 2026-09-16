import { Test, type TestingModule } from "@nestjs/testing";
import { PrinterProcessor } from "./printer.processor";
import { PartTagPdfService } from "./part-tag-pdf.service";
import { IpPrinterService } from "./ip-printer.service";
import { PrinterSettingService } from "./printer-setting.service";
import { PrinterErrorFileLogService } from "./printer-error-file-log.service";
import type { Job } from "bullmq";

describe("PrinterProcessor", () => {
  let processor: PrinterProcessor;
  let pdfService: Pick<PartTagPdfService, "generatePartTagPdf">;
  let printerService: Pick<IpPrinterService, "printPdf">;
  let settingService: Pick<PrinterSettingService, "getActivePrinterIp">;
  let fileLogger: Pick<PrinterErrorFileLogService, "write">;

  beforeEach(async () => {
    pdfService = {
      generatePartTagPdf: jest.fn().mockResolvedValue(Buffer.from("pdf-data")),
    };
    printerService = {
      printPdf: jest.fn().mockResolvedValue(undefined),
    };
    settingService = {
      getActivePrinterIp: jest.fn().mockResolvedValue("192.168.1.50"),
    };
    fileLogger = {
      write: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrinterProcessor,
        { provide: PartTagPdfService, useValue: pdfService },
        { provide: IpPrinterService, useValue: printerService },
        { provide: PrinterSettingService, useValue: settingService },
        { provide: PrinterErrorFileLogService, useValue: fileLogger },
      ],
    }).compile();

    processor = module.get<PrinterProcessor>(PrinterProcessor);
  });

  it("processes printPartTagAnsei job resolving IP from PrinterSetting", async () => {
    const job = {
      id: "job-1",
      name: "printPartTagAnsei",
      data: {
        poId: "PO-100",
        poNumber: "PON-100",
        qtyOrder: 50,
        qtyPerbox: 10,
        partNumber: "FG-001",
        partName: "Widget",
        vendorCode: "V1",
        classificationCode: "A",
        deliveryDate: "2026-09-01",
        receivingArea: "Dock 1",
      },
    } as unknown as Job;

    await processor.process(job);

    expect(settingService.getActivePrinterIp).toHaveBeenCalled();
    expect(pdfService.generatePartTagPdf).toHaveBeenCalledWith(job.data);
    expect(printerService.printPdf).toHaveBeenCalledWith(
      Buffer.from("pdf-data"),
      "192.168.1.50",
      "ANSEI_PartTag_PO-100",
    );
  });
});
