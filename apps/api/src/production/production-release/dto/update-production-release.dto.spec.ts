import { validate } from 'class-validator';
import { UpdateProductionReleaseDto } from './update-production-release.dto';

describe('production duration transport validation', () => {
  it.each([null, 0, -1, 0.5, '480', NaN, Infinity, 2147483648])(
    'rejects invalid duration %s',
    async (value) => {
      const dto = Object.assign(new UpdateProductionReleaseDto(), {
        totalProductionMinutes: value,
      });
      const errors = await validate(dto);
      expect(
        errors.some((error) => error.property === 'totalProductionMinutes'),
      ).toBe(true);
    },
  );

  it.each([undefined, 1, 1440, 1845, 2147483647])(
    'accepts duration %s (closure requiredness is enforced in the service)',
    async (value) => {
      const dto = Object.assign(new UpdateProductionReleaseDto(), {
        totalProductionMinutes: value,
      });
      await expect(validate(dto)).resolves.toEqual([]);
    },
  );
});
