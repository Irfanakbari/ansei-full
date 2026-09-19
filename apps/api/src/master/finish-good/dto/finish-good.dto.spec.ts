import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateFinishGoodDto } from './create-finish-good.dto';
import { UpdateFinishGoodDto } from './update-finish-good.dto';
describe('Finish good passthrough input', () => {
  it.each([true, false])('accepts boolean %s', async (isPassthrough) => {
    expect(
      await validate(
        plainToInstance(CreateFinishGoodDto, {
          partNumber: 'FG',
          partName: 'FG',
          isPassthrough,
        }),
      ),
    ).toHaveLength(0);
    expect(
      await validate(plainToInstance(UpdateFinishGoodDto, { isPassthrough })),
    ).toHaveLength(0);
  });
  it.each([null, 'false', 1])(
    'rejects malformed passthrough %s',
    async (isPassthrough) => {
      expect(
        await validate(plainToInstance(UpdateFinishGoodDto, { isPassthrough })),
      ).not.toHaveLength(0);
    },
  );
  it('does not require passthrough for an unrelated edit', async () => {
    expect(
      await validate(plainToInstance(UpdateFinishGoodDto, { partName: 'FG' })),
    ).toHaveLength(0);
  });
});
