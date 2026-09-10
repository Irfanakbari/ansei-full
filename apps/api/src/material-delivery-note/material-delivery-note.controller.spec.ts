import { Test, TestingModule } from '@nestjs/testing';
import { MaterialDeliveryNoteController } from './material-delivery-note.controller';
import { MaterialDeliveryNoteService } from './material-delivery-note.service';
import type { ICurrentUser } from '../auth/interfaces/current-user.interface';

describe('MaterialDeliveryNoteController', () => {
  let controller: MaterialDeliveryNoteController;
  let service: any;

  const mockUser: ICurrentUser = {
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    roleId: 1,
    roleName: 'Admin',
    sessionId: 'session-123',
    permissions: [
      'TRANSFER_MATERIAL_READ',
      'TRANSFER_MATERIAL_CREATE',
      'TRANSFER_MATERIAL_UPDATE',
      'TRANSFER_MATERIAL_DELETE',
    ],
    departments: ['Warehouse'],
  };

  const mockDeliveryNote = {
    Id: 'uuid-1234',
    DeliveryNoteNum: 'SJ-MAT/2026/06/0001',
    Destination: 'Gudang Subcont A',
    Status: 'DRAFT',
    Notes: 'Transfer untuk produksi',
    CreatedAt: new Date(),
    CreatedBy: 'admin',
    ShippedAt: null,
    ShippedBy: null,
    ReceivedAt: null,
    ReceivedBy: null,
    Details: [
      {
        Id: 1,
        DeliveryNoteId: 'uuid-1234',
        MaterialId: 'MAT-001',
        QtyRequested: 100,
        QtyPicking: 0,
        QtyReceived: null,
        MaterialData: {
          PartNumber: 'MAT-001',
          PartName: 'Test Material',
          QtyWarehouse: 500,
          QtyRack: 100,
        },
      },
    ],
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      getDetails: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      pick: jest.fn(),
      ship: jest.fn(),
      receive: jest.fn(),
      cancel: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaterialDeliveryNoteController],
      providers: [
        { provide: MaterialDeliveryNoteService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<MaterialDeliveryNoteController>(
      MaterialDeliveryNoteController,
    );
    service = module.get(MaterialDeliveryNoteService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new delivery note', async () => {
      const createDto = {
        destination: 'Gudang Subcont A',
        notes: 'Transfer untuk produksi',
        items: [{ materialId: 'MAT-001', qtyRequested: 100 }],
      };
      service.create.mockResolvedValue(mockDeliveryNote);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(mockDeliveryNote);
      expect(service.create).toHaveBeenCalledWith(createDto, mockUser.username);
    });
  });

  describe('findAll', () => {
    it('should return paginated delivery notes', async () => {
      const paginatedResult = {
        data: [mockDeliveryNote],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      service.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll();

      expect(result).toEqual(paginatedResult);
      expect(service.findAll).toHaveBeenCalledWith({
        page: undefined,
        limit: undefined,
        status: undefined,
      });
    });

    it('should filter by status', async () => {
      const paginatedResult = {
        data: [mockDeliveryNote],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      service.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(undefined, undefined, 'DRAFT');

      expect(result).toEqual(paginatedResult);
      expect(service.findAll).toHaveBeenCalledWith({
        page: undefined,
        limit: undefined,
        status: 'DRAFT',
      });
    });
  });

  describe('findOne', () => {
    it('should return a delivery note by id', async () => {
      service.findOne.mockResolvedValue(mockDeliveryNote);

      const result = await controller.findOne('uuid-1234');

      expect(result).toEqual(mockDeliveryNote);
      expect(service.findOne).toHaveBeenCalledWith('uuid-1234');
    });
  });

  describe('getDetails', () => {
    it('should return delivery note details', async () => {
      const details = mockDeliveryNote.Details;
      service.getDetails.mockResolvedValue(details);

      const result = await controller.getDetails('uuid-1234');

      expect(result).toEqual(details);
      expect(service.getDetails).toHaveBeenCalledWith('uuid-1234');
    });
  });

  describe('update', () => {
    it('should update delivery note header', async () => {
      const updateDto = { destination: 'Gudang Subcont B', notes: 'Updated' };
      const updated = { ...mockDeliveryNote, ...updateDto };
      service.update.mockResolvedValue(updated);

      const result = await controller.update('uuid-1234', updateDto, mockUser);

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(
        'uuid-1234',
        updateDto,
        mockUser.username,
      );
    });
  });

  describe('remove', () => {
    it('should delete delivery note', async () => {
      service.remove.mockResolvedValue({ deleted: true, id: 'uuid-1234' });

      const result = await controller.remove('uuid-1234');

      expect(result).toEqual({ deleted: true, id: 'uuid-1234' });
      expect(service.remove).toHaveBeenCalledWith('uuid-1234');
    });
  });

  describe('pick', () => {
    it('should pick materials', async () => {
      const pickDto = {
        items: [{ materialId: 'MAT-001', qtyPicking: 100 }],
      };
      const picked = {
        ...mockDeliveryNote,
        Details: [{ ...mockDeliveryNote.Details[0], QtyPicking: 100 }],
      };
      service.pick.mockResolvedValue(picked);

      const result = await controller.pick('uuid-1234', pickDto, mockUser);

      expect(result).toEqual(picked);
      expect(service.pick).toHaveBeenCalledWith(
        'uuid-1234',
        pickDto,
        mockUser.username,
      );
    });
  });

  describe('ship', () => {
    it('should ship delivery note', async () => {
      const shipped = {
        ...mockDeliveryNote,
        Status: 'SHIPPED',
        ShippedAt: new Date(),
      };
      service.ship.mockResolvedValue(shipped);

      const result = await controller.ship('uuid-1234', mockUser);

      expect(result).toEqual(shipped);
      expect(service.ship).toHaveBeenCalledWith('uuid-1234', mockUser.username);
    });
  });

  describe('receive', () => {
    it('should confirm receipt', async () => {
      const received = {
        ...mockDeliveryNote,
        Status: 'RECEIVED',
        ReceivedAt: new Date(),
      };
      service.receive.mockResolvedValue(received);

      const result = await controller.receive('uuid-1234', mockUser);

      expect(result).toEqual(received);
      expect(service.receive).toHaveBeenCalledWith(
        'uuid-1234',
        mockUser.username,
      );
    });
  });

  describe('cancel', () => {
    it('should cancel delivery note', async () => {
      service.cancel.mockResolvedValue({ cancelled: true, id: 'uuid-1234' });

      const result = await controller.cancel('uuid-1234', mockUser);

      expect(result).toEqual({ cancelled: true, id: 'uuid-1234' });
      expect(service.cancel).toHaveBeenCalledWith(
        'uuid-1234',
        mockUser.username,
      );
    });
  });
});
