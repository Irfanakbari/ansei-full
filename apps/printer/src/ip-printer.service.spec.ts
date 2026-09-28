import { Test, type TestingModule } from "@nestjs/testing";
import { IpPrinterService } from "./ip-printer.service";

describe("IpPrinterService", () => {
  let service: IpPrinterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IpPrinterService],
    }).compile();

    service = module.get<IpPrinterService>(IpPrinterService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("rejects invalid explicit RAW TCP ports before connecting", async () => {
    await expect(
      service.printPdf(Buffer.from("fixture"), "printer-01:70000"),
    ).rejects.toThrow("harus berupa angka 1-65535");
  });

  it("rejects unsupported printer protocols", async () => {
    await expect(
      service.printPdf(Buffer.from("fixture"), "ftp://printer-01:21"),
    ).rejects.toThrow("Protokol printer tidak didukung");
  });
});
