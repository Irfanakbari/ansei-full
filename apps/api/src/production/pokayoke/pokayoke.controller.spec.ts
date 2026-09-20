import { Test, TestingModule } from '@nestjs/testing';
import { PokayokeController } from './pokayoke.controller';
import { PokayokeService } from './pokayoke.service';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

describe('PokayokeController', () => {
  let controller: PokayokeController;
  let service: any;

  const mockUser: ICurrentUser = {
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    roleId: 1,
    roleName: 'Admin',
    sessionId: 'session-123',
    permissions: ['POKAYOKE_CREATE', 'POKAYOKE_READ'],
    departments: ['Production'],
  };

  const mockScan = {
    Id: 1,
    LabelNumber: 'LBL001',
    Status: 'SUKSES',
    PoId: 'PO-001',
    PartNumber: 'FG-001',
    PartName: 'Finish Good A',
    CreatedAt: new Date(),
    CreatedBy: 'testuser',
  };

  beforeEach(async () => {
    const mockService = {
      scan: jest.fn(),
      findAll: jest.fn(),
      getScanOptions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PokayokeController],
      providers: [{ provide: PokayokeService, useValue: mockService }],
    }).compile();

    controller = module.get<PokayokeController>(PokayokeController);
    service = module.get(PokayokeService);
  });

  it('returns scan options', async () => {
    const expected = { labels: [] };
    service.getScanOptions.mockResolvedValue(expected);
    await expect(controller.getScanOptions({ limit: 10 })).resolves.toEqual(
      expected,
    );
    expect(service.getScanOptions).toHaveBeenCalledWith({ limit: 10 });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('scan', () => {
    it('should scan a label successfully', async () => {
      const scanDto = { labelNumber: 'LBL001', status: 'SUKSES' };
      const mockResult = {
        success: true,
        message: 'Scan successful',
        data: mockScan,
      };
      service.scan.mockResolvedValue(mockResult);

      const result = await controller.scan(scanDto, mockUser);

      expect(result).toEqual(mockResult);
      expect(service.scan).toHaveBeenCalledWith(scanDto, mockUser.username);
    });
  });

  describe('findAll', () => {
    it('should return paginated scan history', async () => {
      const mockData = {
        data: [mockScan],
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

    it('should filter by status', async () => {
      const mockData = {
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      };
      service.findAll.mockResolvedValue(mockData);

      await controller.findAll({ status: 'SUKSES' });

      expect(service.findAll).toHaveBeenCalledWith({ status: 'SUKSES' });
    });
  });
});
