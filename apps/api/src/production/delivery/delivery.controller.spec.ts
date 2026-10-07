import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { CreateDeliveryDto } from './dto';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

describe('DeliveryController', () => {
  let controller: DeliveryController;
  let service: any;

  const mockUser: ICurrentUser = {
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    roleId: 1,
    roleName: 'Admin',
    sessionId: 'session-123',
    permissions: ['DELIVERY_CREATE', 'DELIVERY_READ'],
    departments: ['Production'],
  };

  const mockDelivery = {
    Id: 1,
    ProductionDemandId: 'PO-001',
    Qty: 100,
    CreatedAt: new Date(),
    CreatedBy: 'testuser',
    LabelDataId: 'LBL001',
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeliveryController],
      providers: [{ provide: DeliveryService, useValue: mockService }],
    }).compile();

    controller = module.get<DeliveryController>(DeliveryController);
    service = module.get(DeliveryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a delivery successfully', async () => {
      const createDto: CreateDeliveryDto = { labelNumber: 'LBL001' };
      const mockResult = {
        success: true,
        message: 'Delivery successful',
        data: mockDelivery,
      };
      service.create.mockResolvedValue(mockResult);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(mockResult);
      expect(service.create).toHaveBeenCalledWith(createDto, mockUser.username);
    });
  });

  describe('findAll', () => {
    it('should return paginated deliveries', async () => {
      const mockData = {
        data: [mockDelivery],
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

  describe('getPalletOptions', () => {
    it('should return pallet options from service', async () => {
      const mockPallets = [{ kode: 'PP2PANS001', name: 'ANSEI' }];
      service.getPalletOptions = jest.fn().mockResolvedValue(mockPallets);

      const result = await controller.getPalletOptions();

      expect(result).toEqual(mockPallets);
      expect(service.getPalletOptions).toHaveBeenCalled();
    });
  });
});
