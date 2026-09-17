import { Test, TestingModule } from '@nestjs/testing';
import { FrontendService } from './frontend.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FrontendService', () => {
  let service: FrontendService;
  let prisma: {
    finishGood: { findMany: jest.Mock };
    manPower: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      finishGood: { findMany: jest.fn() },
      manPower: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FrontendService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FrontendService>(FrontendService);
  });

  describe('getFinishGoodsList', () => {
    it('should return finish goods with PartNumber, PartName, Alias', async () => {
      const mockFinishGoods = [
        { PartNumber: 'FG-001', PartName: 'Part 1', Alias: 'P1' },
        { PartNumber: 'FG-002', PartName: 'Part 2', Alias: null },
      ];
      prisma.finishGood.findMany.mockResolvedValue(mockFinishGoods);

      const result = await service.getFinishGoodsList();

      expect(result).toEqual(mockFinishGoods);
      expect(prisma.finishGood.findMany).toHaveBeenCalledWith({
        select: {
          PartNumber: true,
          PartName: true,
          Alias: true,
        },
        orderBy: { PartNumber: 'asc' },
      });
    });
  });

  describe('getManPowerList', () => {
    it('should return active manpower with Nik, Name, PicturePath, Line', async () => {
      const mockManPower = [
        {
          Nik: '12345678',
          Name: 'Budi Santoso',
          PicturePath: 'http://nas/pic.jpg',
          Line: 'LINE-A',
        },
      ];
      prisma.manPower.findMany.mockResolvedValue(mockManPower);

      const result = await service.getManPowerList();

      expect(result).toEqual(mockManPower);
      expect(prisma.manPower.findMany).toHaveBeenCalledWith({
        where: { Status: true },
        select: {
          Nik: true,
          Name: true,
          PicturePath: true,
          Line: true,
          SkillMatrix: {
            select: {
              Id: true,
              Label: true,
              Point: true,
            },
          },
        },
        orderBy: { Nik: 'asc' },
      });
    });
  });
});
