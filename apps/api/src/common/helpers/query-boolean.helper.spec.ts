import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AssemblyQueryDto } from '../../production/assembly/dto/assembly.dto';
import { DeliveryQueryDto } from '../../production/delivery/dto/create-delivery.dto';
import { PokayokeScanQueryDto } from '../../production/pokayoke/dto/pokayoke-scan.dto';
import { PreDeliveryQueryDto } from '../../production/pre-delivery/dto/pre-delivery-query.dto';
import { ShoppingQueryDto } from '../../production/shopping/dto/create-shopping.dto';

const queryDtos = [
  AssemblyQueryDto,
  DeliveryQueryDto,
  PokayokeScanQueryDto,
  PreDeliveryQueryDto,
  ShoppingQueryDto,
] as const;

describe('activeReleaseOnly query transformation', () => {
  it.each(queryDtos)(
    '%p preserves false with implicit conversion enabled',
    (Dto) => {
      const dto = plainToInstance(
        Dto,
        { page: '1', limit: '50', activeReleaseOnly: 'false' },
        { enableImplicitConversion: true },
      );

      expect(dto.activeReleaseOnly).toBe(false);
      expect(validateSync(dto)).toHaveLength(0);
    },
  );

  it.each(queryDtos)(
    '%p parses true with implicit conversion enabled',
    (Dto) => {
      const dto = plainToInstance(
        Dto,
        { page: '1', limit: '50', activeReleaseOnly: 'true' },
        { enableImplicitConversion: true },
      );

      expect(dto.activeReleaseOnly).toBe(true);
      expect(validateSync(dto)).toHaveLength(0);
    },
  );
});
