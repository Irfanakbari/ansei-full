import { Test, type TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PrinterSettingService } from "./printer-setting.service";

describe("PrinterSettingService", () => {
  let service: PrinterSettingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrinterSettingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<PrinterSettingService>(PrinterSettingService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("returns null when database pool is not connected", async () => {
    const ip = await service.getActivePrinterIp();
    expect(ip).toBeNull();
  });
});
