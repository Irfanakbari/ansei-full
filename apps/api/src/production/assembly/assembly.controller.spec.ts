/* By Irfan Akbari Vuteq Indonesia - 2026-09-18 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AssemblyController,
  DisplayAssemblyController,
} from './assembly.controller';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { PERMISSIONS_KEY } from '../../auth/decorators/permission.decorator';
import { CancelAssemblyDto, StartAssemblyDto } from './dto/assembly.dto';
describe('Assembly access and validation', () => {
  it('exposes only explicitly approved display operations without login', () => {
    for (const name of ['start', 'complete', 'operator', 'inspect'] as const)
      expect(
        Reflect.getMetadata(
          IS_PUBLIC_KEY,
          DisplayAssemblyController.prototype[name],
        ),
      ).toBe(true);
    expect('cancel' in DisplayAssemblyController.prototype).toBe(false);
    expect('sessions' in DisplayAssemblyController.prototype).toBe(false);
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, AssemblyController),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, AssemblyController.prototype.cancel),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AssemblyController.prototype.cancel),
    ).toEqual(['IPCS.ASSEMBLY_CANCEL']);
  });
  it('rejects empty cancellation reasons', async () => {
    expect(
      await validate(plainToInstance(CancelAssemblyDto, { reason: '  ' })),
    ).not.toHaveLength(0);
  });
  it('requires a request identity and explicit manpower NIK', async () => {
    const errors = await validate(
      plainToInstance(StartAssemblyDto, {
        labelNumber: 'BOX',
        manPowerUid: 'wrong',
      }),
    );
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['requestId', 'manPowerNik']),
    );
  });
});
