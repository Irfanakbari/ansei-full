import { Test, TestingModule } from '@nestjs/testing';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

describe('TransferController', () => {
  let controller: TransferController;
  let service: any;

  const mockUser: ICurrentUser = {
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    roleId: 1,
    roleName: 'Admin',
    sessionId: 'session-123',
    permissions: ['TRANSFER_CREATE'],
    departments: ['Warehouse'],
  };

  beforeEach(async () => {
    const mockService = {
      transferToRack: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransferController],
      providers: [{ provide: TransferService, useValue: mockService }],
    }).compile();

    controller = module.get<TransferController>(TransferController);
    service = module.get(TransferService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('transferToRack', () => {
    it('should transfer material from warehouse to rack', async () => {
      const transferResult = {
        partNumber: 'MAT-001',
        warehouseBefore: 100,
        warehouseAfter: 70,
        rackBefore: 50,
        rackAfter: 80,
        transferQty: 30,
        success: true,
      };
      service.transferToRack.mockResolvedValue(transferResult);

      const result = await controller.transferToRack(
        'MAT-001',
        {
          qty: 30,
          requestId: '00000000-0000-4000-8000-000000000001',
          scanCode: 'RACK-A1',
        },
        mockUser,
      );

      expect(result).toEqual(transferResult);
      expect(service.transferToRack).toHaveBeenCalledWith(
        'MAT-001',
        30,
        mockUser.username,
        '00000000-0000-4000-8000-000000000001',
        'RACK-A1',
      );
    });
  });
});
