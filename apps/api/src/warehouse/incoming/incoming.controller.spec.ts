import { Test, TestingModule } from '@nestjs/testing';
import { IncomingController } from './incoming.controller';
import { IncomingService } from './incoming.service';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

describe('IncomingController', () => {
  let controller: IncomingController;
  let service: any;

  const mockUser: ICurrentUser = {
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    roleId: 1,
    roleName: 'Admin',
    sessionId: 'session-123',
    permissions: [
      'INCOMING_READ',
      'INCOMING_CREATE',
      'INCOMING_UPDATE',
      'INCOMING_DELETE',
    ],
    departments: ['Warehouse'],
  };

  const mockIncoming = {
    Id: 'uuid-1234',
    PoId: 'PO-001',
    Description: 'Test incoming',
    CreatedAt: new Date(),
    UpdatedAt: new Date(),
    ReceivedBy: 'admin',
    ApprovedAt: null,
    Closed: false,
    ApprovedBy: null,
    SupplierId: 1,
    SupplierData: { Id: 1, Name: 'Test Supplier' },
    IncomingMaterial: [],
  };

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByPoId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      receive: jest.fn(),
      check: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IncomingController],
      providers: [{ provide: IncomingService, useValue: mockService }],
    }).compile();

    controller = module.get<IncomingController>(IncomingController);
    service = module.get(IncomingService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all incomings', async () => {
      service.findAll.mockResolvedValue([mockIncoming]);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual([mockIncoming]);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return incoming by id', async () => {
      service.findOne.mockResolvedValue(mockIncoming);

      const result = await controller.findOne('uuid-1234', mockUser);

      expect(result).toEqual(mockIncoming);
      expect(service.findOne).toHaveBeenCalledWith('uuid-1234');
    });
  });

  describe('findByPoId', () => {
    it('should return incoming by PO ID', async () => {
      service.findByPoId.mockResolvedValue(mockIncoming);

      const result = await controller.findByPoId('PO-001', mockUser);

      expect(result).toEqual(mockIncoming);
      expect(service.findByPoId).toHaveBeenCalledWith('PO-001');
    });
  });

  describe('create', () => {
    it('should create new incoming', async () => {
      const createDto = {
        id: 'uuid-1234',
        poId: 'PO-001',
        receivedBy: 'admin',
        supplierId: 1,
        materials: [{ materialId: 1, qty: 50 }],
      };
      service.create.mockResolvedValue(mockIncoming);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(mockIncoming);
      expect(service.create).toHaveBeenCalledWith(createDto, mockUser.username);
    });
  });

  describe('update', () => {
    it('should update incoming', async () => {
      const updateDto = { description: 'Updated' };
      const updatedIncoming = { ...mockIncoming, Description: 'Updated' };
      service.update.mockResolvedValue(updatedIncoming);

      const result = await controller.update('uuid-1234', updateDto, mockUser);

      expect(result).toEqual(updatedIncoming);
      expect(service.update).toHaveBeenCalledWith(
        'uuid-1234',
        updateDto,
        mockUser.username,
      );
    });
  });

  describe('remove', () => {
    it('should delete incoming', async () => {
      service.remove.mockResolvedValue({ deleted: true, id: 'uuid-1234' });

      const result = await controller.remove('uuid-1234', mockUser);

      expect(result).toEqual({ deleted: true, id: 'uuid-1234' });
      expect(service.remove).toHaveBeenCalledWith(
        'uuid-1234',
        mockUser.username,
      );
    });
  });

  describe('receive', () => {
    it('should receive incoming', async () => {
      const receiveResult = {
        id: 'uuid-1234',
        poId: 'PO-001',
        status: 'APPROVED',
        approvedAt: new Date(),
        totalItems: 1,
        totalQty: 50,
        inventoryUpdated: true,
      };
      service.receive.mockResolvedValue(receiveResult);

      const result = await controller.receive('uuid-1234', mockUser);

      expect(result).toEqual(receiveResult);
      expect(service.receive).toHaveBeenCalledWith(
        'uuid-1234',
        mockUser.username,
      );
    });
  });

  describe('check', () => {
    it('should check incoming materials', async () => {
      const checkDto = {
        materials: [{ incomingMaterialId: 1, qtyChecked: 100 }],
      };
      const checkResult = {
        id: 'uuid-1234',
        poId: 'PO-001',
        status: 'CHECKED',
        checkedAt: new Date(),
        checkedBy: 'testuser',
        totalItems: 1,
        materialsChecked: [
          {
            incomingMaterialId: 1,
            materialId: 1,
            partNumber: 'MAT-001',
            qtyExpected: 100,
            qtyChecked: 100,
          },
        ],
      };
      service.check.mockResolvedValue(checkResult);

      const result = await controller.check('uuid-1234', checkDto, mockUser);

      expect(result).toEqual(checkResult);
      expect(service.check).toHaveBeenCalledWith(
        'uuid-1234',
        checkDto,
        mockUser.username,
      );
    });
  });
});
