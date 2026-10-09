/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateFinishGoodDto } from './create-finish-good.dto';
import { UpdateFinishGoodDto } from './update-finish-good.dto';

describe('SAP part number DTO', () => {
  for (const dtoType of [CreateFinishGoodDto, UpdateFinishGoodDto]) {
    it.each([undefined, null, '', '   ', 'SAP-001'])(
      'accepts optional string/null %s',
      async (partNumberSAP) => {
        const dto = plainToInstance(
          dtoType,
          { partNumber: 'PART', partName: 'Part', partNumberSAP },
          { enableImplicitConversion: true },
        );
        expect(await validate(dto)).toHaveLength(0);
      },
    );
    it.each([123, true, {}, []])(
      'rejects non-string input %s',
      async (partNumberSAP) => {
        const dto = plainToInstance(
          dtoType,
          { partNumber: 'PART', partName: 'Part', partNumberSAP },
          { enableImplicitConversion: true },
        );
        expect(
          (await validate(dto)).some(
            (error) => error.property === 'partNumberSAP',
          ),
        ).toBe(true);
      },
    );
  }
});
