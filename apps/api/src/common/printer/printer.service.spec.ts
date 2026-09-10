import { Test, type TestingModule } from '@nestjs/testing';
import type { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { PrinterService } from './printer.service';
import {
  PRINT_PART_TAG_ANSEI,
  PRINTER_SERVICE,
  type PartTagAnseiPayload,
} from './printer.types';

describe('PrinterService', () => {
  let service: PrinterService;
  let client: Pick<ClientProxy, 'emit'>;

  beforeEach(async () => {
    client = { emit: jest.fn().mockReturnValue(of(undefined)) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrinterService,
        { provide: PRINTER_SERVICE, useValue: client },
      ],
    }).compile();
    service = module.get(PrinterService);
  });

  it('emits the typed part tag event', async () => {
    const payload = { qtyPerbox: 10 } as PartTagAnseiPayload;
    await service.printPartTagAnsei(payload);
    expect(client.emit).toHaveBeenCalledWith(PRINT_PART_TAG_ANSEI, payload);
  });

  it('rejects when the broker emit fails', async () => {
    jest
      .mocked(client.emit)
      .mockReturnValue(throwError(() => new Error('RMQ')));
    await expect(
      service.printPartTagAnsei({ qtyPerbox: 10 } as PartTagAnseiPayload),
    ).rejects.toThrow('RMQ');
  });
});
