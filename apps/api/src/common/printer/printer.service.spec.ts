import { Test, type TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrinterService } from './printer.service';
import {
  PRINT_PART_TAG_ANSEI,
  type PartTagAnseiPayload,
} from './printer.types';

describe('PrinterService', () => {
  let service: PrinterService;
  let queue: Pick<Queue, 'add'>;

  beforeEach(async () => {
    queue = { add: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrinterService,
        { provide: getQueueToken('printer_queue'), useValue: queue },
      ],
    }).compile();
    service = module.get(PrinterService);
  });

  it('enqueues print job to BullMQ queue', async () => {
    const payload: PartTagAnseiPayload = {
      poId: 'PO-001',
      poNumber: 'PO-NUM-1',
      qtyOrder: 100,
      partNumber: 'PART-1',
      partName: 'Part One',
      vendorCode: 'V-01',
      classificationCode: 'A',
      deliveryDate: new Date('2026-09-01'),
      qtyPerbox: 10,
      receivingArea: 'AREA-A',
    };

    await service.printPartTagAnsei(payload);

    expect(queue.add).toHaveBeenCalledWith(
      PRINT_PART_TAG_ANSEI,
      payload,
      expect.objectContaining({
        removeOnComplete: true,
        attempts: 3,
      }),
    );
  });

  it('rejects when the queue add fails', async () => {
    jest.mocked(queue.add).mockRejectedValue(new Error('Redis Down'));
    await expect(
      service.printPartTagAnsei({
        poNumber: 'PO-1',
        qtyPerbox: 10,
      } as PartTagAnseiPayload),
    ).rejects.toThrow('Redis Down');
  });
});
