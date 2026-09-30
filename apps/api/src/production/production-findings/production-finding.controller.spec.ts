import { Test } from '@nestjs/testing';
import { ProductionFindingController } from './production-finding.controller';
import { ProductionFindingService } from './production-finding.service';

const requestId = '11111111-1111-4111-8111-111111111111';

describe('ProductionFindingController', () => {
  it('forwards an ASSY material finding submission', async () => {
    const service = {
      submitMaterial: jest.fn().mockResolvedValue({ Id: 'finding-1' }),
    };
    const module = await Test.createTestingModule({
      controllers: [ProductionFindingController],
      providers: [{ provide: ProductionFindingService, useValue: service }],
    }).compile();
    const dto = {
      requestId,
      materialId: 'MAT-1',
      location: 'ASSY' as const,
      qty: 2,
      reason: 'Damaged during assembly',
      reporter: 'operator',
    };

    await expect(
      module.get(ProductionFindingController).submitMaterial(dto),
    ).resolves.toEqual({ Id: 'finding-1' });
    expect(service.submitMaterial).toHaveBeenCalledWith(dto);
  });
});
