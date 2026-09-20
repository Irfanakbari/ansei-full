import { Test, TestingModule } from '@nestjs/testing';
import { FrontendController } from './frontend.controller';
import { FrontendService } from './frontend.service';
import { NotificationResponseEntity } from './entities/notification-response.entity';
import { DashboardResponseEntity } from './entities/dashboard-response.entity';

describe('FrontendController', () => {
  let controller: FrontendController;
  let service: {
    getFinishGoodsList: jest.Mock;
    getDisplayTarget: jest.Mock;
    getManPowerList: jest.Mock;
    getProductionStatus: jest.Mock;
    getNotifications: jest.Mock;
    getDashboard: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getFinishGoodsList: jest.fn(),
      getDisplayTarget: jest.fn(),
      getManPowerList: jest.fn(),
      getProductionStatus: jest.fn(),
      getNotifications: jest.fn(),
      getDashboard: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FrontendController],
      providers: [{ provide: FrontendService, useValue: service }],
    }).compile();

    controller = module.get<FrontendController>(FrontendController);
  });

  it('should return finish goods list', async () => {
    const mock = [{ PartNumber: 'FG-001', PartName: 'Part 1', Alias: 'P1' }];
    service.getFinishGoodsList.mockResolvedValue(mock);

    const result = await controller.getFinishGoods();

    expect(result).toEqual(mock);
    expect(service.getFinishGoodsList).toHaveBeenCalled();
  });

  it('should return a display target for the selected part number', async () => {
    const mock = {
      partNumber: 'FG-001',
      partName: 'Part 1',
      alias: 'P1',
      targetQty: 25,
      productionReleaseId: 'release-1',
      releaseNumber: 'PR-001',
    };
    service.getDisplayTarget.mockResolvedValue(mock);

    const result = await controller.getDisplayTarget({
      partNumber: 'FG-001',
    });

    expect(result).toEqual(mock);
    expect(service.getDisplayTarget).toHaveBeenCalledWith('FG-001');
  });

  it('should return manpower list', async () => {
    const mock = [
      {
        Nik: '12345678',
        Name: 'Budi Santoso',
        PicturePath: 'http://nas/pic.jpg',
        Line: 'LINE-A',
      },
    ];
    service.getManPowerList.mockResolvedValue(mock);

    const result = await controller.getManPower();

    expect(result).toEqual(mock);
    expect(service.getManPowerList).toHaveBeenCalled();
  });

  it('should delegate notifications and document the response entity', async () => {
    const mock = {
      totalPOWithoutAttachment: 0,
      byProductionRelease: [],
      totalIncomingNotClosed: 0,
      incomingNotClosed: [],
      totalStockOpnameInProgress: 0,
      stockOpnameInProgress: [],
      totalLabelDataNotScanned: 0,
      labelDataNotScanned: [],
      totalAssemblyInProgress: 0,
      assemblyInProgress: [],
      messages: [],
    };
    service.getNotifications.mockResolvedValue(mock);

    await expect(controller.getNotifications()).resolves.toEqual(mock);
    expect(service.getNotifications).toHaveBeenCalledTimes(1);
    expect(
      Reflect.getMetadata(
        'swagger/apiResponse',
        FrontendController.prototype.getNotifications,
      ),
    ).toMatchObject({ '200': { type: NotificationResponseEntity } });
  });

  it('delegates dashboard queries and documents the response entity', async () => {
    const query = { month: 9, year: 2026 };
    const mock = { meta: { period: '2026-09' } };
    service.getDashboard.mockResolvedValue(mock);

    await expect(controller.getDashboard(query)).resolves.toEqual(mock);
    expect(service.getDashboard).toHaveBeenCalledWith(query);
    expect(
      Reflect.getMetadata(
        'swagger/apiResponse',
        FrontendController.prototype.getDashboard,
      ),
    ).toMatchObject({ '200': { type: DashboardResponseEntity } });
  });
});
