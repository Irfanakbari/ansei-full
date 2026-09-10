import { Test, TestingModule } from '@nestjs/testing';
import { ForecastController } from './forecast.controller';
import { ForecastService } from './forecast.service';
import { CreateForecastDto } from './dto';
import type { ForecastModel } from '../../generated/prisma/models';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

describe('ForecastController', () => {
  let controller: ForecastController;
  let service: any;

  const mockUser: ICurrentUser = {
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    roleId: 1,
    roleName: 'Admin',
    sessionId: 'session-123',
    permissions: [
      'FORECAST_READ',
      'FORECAST_CREATE',
      'FORECAST_UPDATE',
      'FORECAST_DELETE',
    ],
    departments: ['Production'],
  };

  const mockForecast: ForecastModel = {
    Id: 1,
    PoId: 'PO-001',
    Date: new Date('2026-06-01'),
    VendorCode: 'V001',
    VendorName: 'Test Vendor',
    ReceivingArea: 'Area A',
    DeliveryDate: new Date('2026-06-10'),
    DeliveryPeriod: 5,
    Classification: 'CLASS-A',
    PoNumber: 'PO12345',
    Item: 1,
    Qty: 100,
    FinishGoodId: 'FG001',
    ProductionReleaseId: null,
  };

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findForAI: jest.fn(),
      findForOperator: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      importExcel: jest.fn(),
      printTag: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ForecastController],
      providers: [{ provide: ForecastService, useValue: mockService }],
    }).compile();

    controller = module.get<ForecastController>(ForecastController);
    service = module.get(ForecastService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all forecasts', async () => {
      const mockForecasts = [mockForecast];
      service.findAll.mockResolvedValue(mockForecasts);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual(mockForecasts);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findForOperator', () => {
    it('should return forecasts for operator (next 14 days)', async () => {
      const mockForecasts = [mockForecast];
      service.findForOperator.mockResolvedValue(mockForecasts);

      const result = await controller.findForOperator(mockUser);

      expect(result).toEqual(mockForecasts);
      expect(service.findForOperator).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a forecast by id', async () => {
      service.findOne.mockResolvedValue(mockForecast);

      const result = await controller.findOne('1', mockUser);

      expect(result).toEqual(mockForecast);
      expect(service.findOne).toHaveBeenCalledWith('1');
    });

    it('should return a forecast by PoId', async () => {
      service.findOne.mockResolvedValue(mockForecast);

      const result = await controller.findOne('PO-001', mockUser);

      expect(result).toEqual(mockForecast);
      expect(service.findOne).toHaveBeenCalledWith('PO-001');
    });
  });

  describe('create', () => {
    it('should create a new forecast', async () => {
      const createDto: CreateForecastDto = {
        poId: 'PO-001',
        date: new Date('2026-06-01'),
        vendorCode: 'V001',
        vendorName: 'Test Vendor',
        receivingArea: 'Area A',
        deliveryDate: new Date('2026-06-10'),
        deliveryPeriod: 5,
        classification: 'CLASS-A',
        poNumber: 'PO12345',
        item: 1,
        qty: 100,
        finishGoodId: 'FG001',
      };
      service.create.mockResolvedValue(mockForecast);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(mockForecast);
      expect(service.create).toHaveBeenCalledWith(createDto, mockUser.username);
    });
  });

  describe('importExcel', () => {
    it('should import forecasts from Excel file', async () => {
      const mockFile = {
        buffer: Buffer.from('test'),
        originalname: 'forecast.xlsx',
      } as Express.Multer.File;
      const importResult = { total: 10, created: 10, skipped: 0 };
      service.importExcel.mockResolvedValue(importResult);

      const result = await controller.importExcel(mockFile, mockUser);

      expect(result).toEqual(importResult);
      expect(service.importExcel).toHaveBeenCalledWith(
        mockFile,
        mockUser.username,
      );
    });

    it('should throw error if file is not provided', async () => {
      await expect(
        controller.importExcel(null as any, mockUser),
      ).rejects.toThrow('File is required');
    });
  });

  describe('update', () => {
    it('should update a forecast', async () => {
      const updateDto = { qty: 200 };
      const updatedForecast = { ...mockForecast, Qty: 200 };
      service.update.mockResolvedValue(updatedForecast);

      const result = await controller.update('1', updateDto, mockUser);

      expect(result).toEqual(updatedForecast);
      expect(service.update).toHaveBeenCalledWith(
        '1',
        updateDto,
        mockUser.username,
      );
    });
  });

  describe('remove', () => {
    it('should delete a forecast', async () => {
      service.remove.mockResolvedValue({ deleted: true, id: 1 });

      const result = await controller.remove('1', mockUser);

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(service.remove).toHaveBeenCalledWith('1', mockUser.username);
    });
  });

  describe('printTag', () => {
    it('should call printTag on service', async () => {
      const printResult = {
        message: 'Data PO ditemukan, proses pencetakan akan dilakukan segera',
        poId: mockForecast.PoId,
        qtyOrder: mockForecast.Qty,
        partNumber: mockForecast.FinishGoodId,
        partName: 'Test Part',
        vendorCode: mockForecast.VendorCode,
        classificationCode: mockForecast.Classification,
        deliveryDate: mockForecast.DeliveryDate,
        qtyPerbox: 10,
        poNumber: mockForecast.PoNumber,
        receivingArea: mockForecast.ReceivingArea,
      };
      service.printTag.mockResolvedValue(printResult);

      const result = await controller.printTag('PO-001', mockUser);

      expect(result).toEqual(printResult);
      expect(service.printTag).toHaveBeenCalledWith(
        'PO-001',
        mockUser.username,
      );
    });
  });
});
