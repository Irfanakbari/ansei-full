import { Test, TestingModule } from '@nestjs/testing';
import { ProductionReportController } from './production-report.controller';
import { ProductionReportService } from './production-report.service';
import { CreateProductionReportDto } from './dto';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

describe('ProductionReportController', () => {
  let controller: ProductionReportController;
  let service: any;

  const mockUser: ICurrentUser = {
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    roleId: 1,
    roleName: 'Admin',
    sessionId: 'session-123',
    permissions: ['PRODUCTION_REPORT_READ', 'PRODUCTION_REPORT_CREATE'],
    departments: ['Production'],
  };

  const mockReport = {
    Id: 1,
    Date: '2026-06-10',
    Qty: 100,
    NgQty: 5,
    ManPowerUid: 'uid-1',
    FinishGoodId: 'FG-001',
    RecordType: 'ONE',
  };

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      validateReport: jest.fn(),
      unvalidateReport: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductionReportController],
      providers: [{ provide: ProductionReportService, useValue: mockService }],
    }).compile();

    controller = module.get<ProductionReportController>(
      ProductionReportController,
    );
    service = module.get(ProductionReportService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated reports', async () => {
      const mockData = {
        data: [mockReport],
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
  });

  describe('findOne', () => {
    it('should return a report by id', async () => {
      service.findOne.mockResolvedValue(mockReport);

      const result = await controller.findOne(1);

      expect(result).toEqual(mockReport);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('create', () => {
    it('should create a new report', async () => {
      const createDto: CreateProductionReportDto = {
        productionStamp: '2026-06-10T08:00:00Z',
        recordType: 'ONE',
        qty: 100,
        manPowerUid: 'uid-1',
        finishGoodId: 'FG-001',
      };
      service.create.mockResolvedValue(mockReport);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(mockReport);
      expect(service.create).toHaveBeenCalledWith(createDto, mockUser.username);
    });
  });

  describe('update', () => {
    it('should update a report', async () => {
      const updateDto = { qty: 150 };
      const updated = { ...mockReport, Qty: 150 };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(1, updateDto, mockUser);

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(
        1,
        updateDto,
        mockUser.username,
      );
    });
  });

  describe('remove', () => {
    it('should delete a report', async () => {
      service.remove.mockResolvedValue({ deleted: true, id: 1 });

      const result = await controller.remove(1, mockUser);

      expect(result).toEqual({ deleted: true, id: 1 });
      expect(service.remove).toHaveBeenCalledWith(1, mockUser.username);
    });
  });

  describe('validate', () => {
    it('should validate a report', async () => {
      const validated = { ...mockReport, ValidatedAt: new Date() };
      service.validateReport.mockResolvedValue(validated);

      const result = await controller.validate(1, mockUser);

      expect(result).toEqual(validated);
      expect(service.validateReport).toHaveBeenCalledWith(1, mockUser.username);
    });
  });

  describe('unvalidate', () => {
    it('should unvalidate a report', async () => {
      const unvalidated = { ...mockReport, ValidatedAt: null };
      service.unvalidateReport.mockResolvedValue(unvalidated);

      const result = await controller.unvalidate(1, mockUser);

      expect(result).toEqual(unvalidated);
      expect(service.unvalidateReport).toHaveBeenCalledWith(
        1,
        mockUser.username,
      );
    });
  });
});
