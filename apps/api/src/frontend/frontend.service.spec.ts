import { Test, TestingModule } from '@nestjs/testing';
import { FrontendService } from './frontend.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FrontendService', () => {
  let service: FrontendService;
  let prisma: {
    finishGood: { findMany: jest.Mock; findUnique: jest.Mock };
    manPower: { findMany: jest.Mock };
    productionRelease: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      finishGood: { findMany: jest.fn(), findUnique: jest.fn() },
      manPower: { findMany: jest.fn() },
      productionRelease: { findFirst: jest.fn() },
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

  describe('getDisplayTarget', () => {
    it('should sum forecasts for the part number in the active release', async () => {
      prisma.finishGood.findUnique.mockResolvedValue({
        PartNumber: 'FG-001',
        PartName: 'Part 1',
        Alias: 'P1',
      });
      prisma.productionRelease.findFirst.mockResolvedValue({
        Id: 'release-1',
        ReleaseNumber: 'PR-001',
        Forecasts: [{ Qty: 10 }, { Qty: 15 }],
      });

      await expect(service.getDisplayTarget('FG-001')).resolves.toEqual({
        partNumber: 'FG-001',
        partName: 'Part 1',
        alias: 'P1',
        targetQty: 25,
        productionReleaseId: 'release-1',
        releaseNumber: 'PR-001',
      });
      expect(prisma.productionRelease.findFirst).toHaveBeenCalledWith({
        where: { Status: 'RELEASED' },
        select: {
          Id: true,
          ReleaseNumber: true,
          Forecasts: {
            where: { FinishGoodId: 'FG-001' },
            select: { Qty: true },
          },
        },
        orderBy: { PlanDate: 'desc' },
      });
    });

    it('should return zero when no production release is active', async () => {
      prisma.finishGood.findUnique.mockResolvedValue({
        PartNumber: 'FG-001',
        PartName: 'Part 1',
        Alias: null,
      });
      prisma.productionRelease.findFirst.mockResolvedValue(null);

      await expect(service.getDisplayTarget('FG-001')).resolves.toEqual({
        partNumber: 'FG-001',
        partName: 'Part 1',
        alias: null,
        targetQty: 0,
        productionReleaseId: null,
        releaseNumber: null,
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
