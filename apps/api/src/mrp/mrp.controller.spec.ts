import { Test, TestingModule } from '@nestjs/testing';
import { MrpController } from './mrp.controller';
import { MrpService } from './mrp.service';
import type { MrpCalculateResponse } from './dto/mrp-calculate.dto';
import { PERMISSIONS_KEY } from '../auth/decorators/permission.decorator';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

describe('MrpController', () => {
  let controller: MrpController;
  let mrpService: jest.Mocked<MrpService>;

  const mockMrpResponse: MrpCalculateResponse = {
    calculatedAt: '2026-06-18T12:00:00.000Z',
    dateRange: {
      today: '2026-06-18',
      startDate: '2026-06-19',
      endDate: '2026-06-24',
    },
    materials: [
      {
        materialId: 1,
        partNumber: 'MAT-001',
        partName: 'Material A',
        supplier: 'Supplier A',
        rackLocation: 'A-01',
        qtyRack: 100,
        qtyWarehouse: 50,
        qtyPending: 25,
        qtyCurrentTotal: 175,
        dailyDemand: [
          { date: '2026-06-18', demand: 0, lack: 0, hasShortage: false },
          { date: '2026-06-19', demand: 0, lack: 0, hasShortage: false },
          { date: '2026-06-20', demand: 0, lack: 0, hasShortage: false },
          { date: '2026-06-21', demand: 0, lack: 0, hasShortage: false },
          { date: '2026-06-22', demand: 0, lack: 0, hasShortage: false },
          { date: '2026-06-23', demand: 0, lack: 0, hasShortage: false },
          { date: '2026-06-24', demand: 0, lack: 0, hasShortage: false },
        ],
      },
      {
        materialId: 2,
        partNumber: 'MAT-002',
        partName: 'Material B',
        supplier: 'Supplier B',
        rackLocation: 'B-02',
        qtyRack: 200,
        qtyWarehouse: 100,
        qtyPending: 50,
        qtyCurrentTotal: 350,
        dailyDemand: [
          { date: '2026-06-18', demand: 200, lack: 0, hasShortage: false },
          { date: '2026-06-19', demand: 0, lack: 0, hasShortage: false },
          { date: '2026-06-20', demand: 0, lack: 0, hasShortage: false },
          { date: '2026-06-21', demand: 0, lack: 0, hasShortage: false },
          { date: '2026-06-22', demand: 0, lack: 0, hasShortage: false },
          { date: '2026-06-23', demand: 0, lack: 0, hasShortage: false },
          { date: '2026-06-24', demand: 0, lack: 0, hasShortage: false },
        ],
      },
    ],
  };

  beforeEach(async () => {
    const mockMrpService = {
      calculate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MrpController],
      providers: [{ provide: MrpService, useValue: mockMrpService }],
    }).compile();

    controller = module.get<MrpController>(MrpController);
    mrpService = module.get(MrpService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('protects export with MRP read permission and no public bypass', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, controller.exportToExcel),
    ).toEqual(['IPCS.MRP_READ']);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, controller.exportToExcel),
    ).not.toBe(true);
  });

  describe('calculate', () => {
    it('should return MRP calculation results', async () => {
      mrpService.calculate.mockResolvedValue(mockMrpResponse);

      const result = await controller.calculate();

      expect(result).toEqual(mockMrpResponse);
      expect(mrpService.calculate).toHaveBeenCalled();
    });

    it('should call mrpService.calculate once', async () => {
      mrpService.calculate.mockResolvedValue(mockMrpResponse);

      await controller.calculate();

      expect(mrpService.calculate).toHaveBeenCalledTimes(1);
    });

    it('should return correct material count', async () => {
      mrpService.calculate.mockResolvedValue(mockMrpResponse);

      const result = await controller.calculate();

      expect(result.materials).toHaveLength(2);
    });

    it('should return correct date range', async () => {
      mrpService.calculate.mockResolvedValue(mockMrpResponse);

      const result = await controller.calculate();

      expect(result.dateRange.today).toBe('2026-06-18');
      expect(result.dateRange.startDate).toBe('2026-06-19');
      expect(result.dateRange.endDate).toBe('2026-06-24');
    });

    it('should return correct material details', async () => {
      mrpService.calculate.mockResolvedValue(mockMrpResponse);

      const result = await controller.calculate();

      const material1 = result.materials[0];
      expect(material1.materialId).toBe(1);
      expect(material1.partNumber).toBe('MAT-001');
      expect(material1.qtyRack).toBe(100);
      expect(material1.qtyWarehouse).toBe(50);
      expect(material1.qtyPending).toBe(25);
      expect(material1.qtyCurrentTotal).toBe(175);
    });

    it('should return daily demand with correct structure', async () => {
      mrpService.calculate.mockResolvedValue(mockMrpResponse);

      const result = await controller.calculate();

      const dailyDemand = result.materials[0].dailyDemand;
      expect(dailyDemand).toHaveLength(7);

      const firstDay = dailyDemand[0];
      expect(firstDay).toHaveProperty('date');
      expect(firstDay).toHaveProperty('demand');
      expect(firstDay).toHaveProperty('lack');
    });
  });
});
