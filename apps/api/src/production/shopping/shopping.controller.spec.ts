import { Test, TestingModule } from '@nestjs/testing';
import { ShoppingController } from './shopping.controller';
import { ShoppingService } from './shopping.service';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { TypeShopping } from '../../generated/prisma/enums';

describe('ShoppingController', () => {
  let controller: ShoppingController;
  let service: any;

  const mockUser: ICurrentUser = {
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    roleId: 1,
    roleName: 'Admin',
    sessionId: 'session-123',
    permissions: [
      'SHOPPING_READ',
      'SHOPPING_CREATE',
      'SHOPPING_UPDATE',
      'SHOPPING_DELETE',
    ],
    departments: ['Warehouse'],
  };

  const mockShopping = {
    Id: 'shopping-001',
    Description: 'Test',
    Type: 'REGULER',
    CreatedAt: new Date(),
    UpdatedAt: new Date(),
    ForecastId: 'PO-001',
    CreatedBy: 'admin',
    QtyPick: 10,
    MaterialId: 'MAT-001',
    MaterialData: {
      Id: 1,
      PartNumber: 'MAT-001',
      PartName: 'Test Material',
      QtyRack: 100,
    },
    ForecastData: { Id: 1, PoId: 'PO-001', Qty: 100, DeliveryDate: new Date() },
  };

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByForecastId: jest.fn(),
      findByMaterialId: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShoppingController],
      providers: [{ provide: ShoppingService, useValue: mockService }],
    }).compile();

    controller = module.get<ShoppingController>(ShoppingController);
    service = module.get(ShoppingService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all shopping', async () => {
      service.findAll.mockResolvedValue([mockShopping]);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual([mockShopping]);
    });
  });

  describe('findOne', () => {
    it('should return shopping by id', async () => {
      service.findOne.mockResolvedValue(mockShopping);

      const result = await controller.findOne('shopping-001', mockUser);

      expect(result).toEqual(mockShopping);
    });
  });

  describe('findByForecastId', () => {
    it('should return shopping by forecast id', async () => {
      service.findByForecastId.mockResolvedValue([mockShopping]);

      const result = await controller.findByForecastId('PO-001', mockUser);

      expect(result).toEqual([mockShopping]);
    });
  });

  describe('findByMaterialId', () => {
    it('should return shopping by material id', async () => {
      service.findByMaterialId.mockResolvedValue([mockShopping]);

      const result = await controller.findByMaterialId('MAT-001', mockUser);

      expect(result).toEqual([mockShopping]);
    });
  });

  describe('create', () => {
    it('should create shopping', async () => {
      const createDto = {
        id: 'shopping-001',
        forecastId: 'PO-001',
        materialId: 'MAT-001',
        qtyPick: 10,
        type: TypeShopping.REGULER,
      };
      service.create.mockResolvedValue(mockShopping);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(mockShopping);
    });
  });

  describe('remove', () => {
    it('should delete shopping', async () => {
      service.remove.mockResolvedValue({ deleted: true, id: 'shopping-001' });

      const result = await controller.remove('shopping-001', mockUser);

      expect(result).toEqual({ deleted: true, id: 'shopping-001' });
    });
  });
});
