import { Test, TestingModule } from '@nestjs/testing';
import { PreDeliveryController } from './pre-delivery.controller';
import { PreDeliveryService } from './pre-delivery.service';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

describe('PreDeliveryController', () => {
  let controller: PreDeliveryController;
  let service: any;

  const mockUser: ICurrentUser = {
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    roleId: 1,
    roleName: 'Admin',
    sessionId: 'session-123',
    permissions: ['PRE_DELIVERY_READ'],
    departments: ['Production'],
  };

  const mockLabel = {
    Id: 1,
    LabelNumber: 'LBL001',
    ForecastId: 'PO-001',
    FinishGoodId: 'FG-001',
    Scanned: false,
    QtyThisBox: 100,
  };

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      getSummary: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PreDeliveryController],
      providers: [{ provide: PreDeliveryService, useValue: mockService }],
    }).compile();

    controller = module.get<PreDeliveryController>(PreDeliveryController);
    service = module.get(PreDeliveryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated labels', async () => {
      const mockData = {
        data: [mockLabel],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      service.findAll.mockResolvedValue(mockData);

      const result = await controller.findAll({ page: 1, limit: 50 });

      expect(result).toEqual(mockData);
      expect(service.findAll).toHaveBeenCalled();
    });

    it('should filter by forecastId', async () => {
      const mockData = {
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      };
      service.findAll.mockResolvedValue(mockData);

      await controller.findAll({ forecastId: 'PO-001' });

      expect(service.findAll).toHaveBeenCalledWith({ forecastId: 'PO-001' });
    });
  });

  describe('getSummary', () => {
    it('should return summary statistics', async () => {
      const mockSummary = {
        total: 100,
        scanned: 50,
        notScanned: 50,
        percentage: 50,
      };
      service.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.getSummary({});

      expect(result).toEqual(mockSummary);
      expect(service.getSummary).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a label by id', async () => {
      service.findOne.mockResolvedValue(mockLabel);

      const result = await controller.findOne(1);

      expect(result).toEqual(mockLabel);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });

    it('should return null when not found', async () => {
      service.findOne.mockResolvedValue(null);

      const result = await controller.findOne(999);

      expect(result).toBeNull();
    });
  });
});
