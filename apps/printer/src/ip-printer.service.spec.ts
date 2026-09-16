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
});
