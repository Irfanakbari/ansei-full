import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { validate } from 'class-validator';
import { PERMISSIONS_KEY } from '../../auth/decorators/permission.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { AssemblyProcessSettingController } from './assembly-process-setting.controller';
import { AssemblyProcessSettingService } from './assembly-process-setting.service';
import { UpdateAssemblyProcessSettingDto } from './dto/update-assembly-process-setting.dto';

describe('AssemblyProcessSettingController', () => {
  const service = {
    find: jest.fn(),
    update: jest.fn(),
  };
  const controller = new AssemblyProcessSettingController(
    service as unknown as AssemblyProcessSettingService,
  );
  const user = {
    username: 'admin',
    name: 'Administrator',
    email: 'admin@example.com',
    roleId: 1,
    roleName: 'ADMIN',
    sessionId: 'session',
    permissions: ['IPCS.MASTER_READ', 'IPCS.MASTER_UPDATE'],
    departments: [],
  } satisfies ICurrentUser;

  beforeEach(() => jest.clearAllMocks());

  it('declares the expected route, methods, and existing permissions', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, AssemblyProcessSettingController),
    ).toBe('settings/assembly-process');
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        AssemblyProcessSettingController.prototype.find,
      ),
    ).toBe(RequestMethod.GET);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        AssemblyProcessSettingController.prototype.find,
      ),
    ).toEqual(['IPCS.MASTER_READ']);
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        AssemblyProcessSettingController.prototype.update,
      ),
    ).toBe(RequestMethod.PATCH);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        AssemblyProcessSettingController.prototype.update,
      ),
    ).toEqual(['IPCS.MASTER_UPDATE']);
  });

  it('propagates reads to the service', async () => {
    const expected = { Id: 1, BypassAllAssembly: false };
    service.find.mockResolvedValue(expected);
    await expect(controller.find(user)).resolves.toEqual(expected);
    expect(service.find).toHaveBeenCalledWith();
  });

  it('propagates the validated DTO and current actor to the service', async () => {
    const dto = {
      bypassAllAssembly: true,
      expectedUpdatedAt: '2026-10-26T00:00:00.000Z',
      reason: 'Planned line operation',
    };
    service.update.mockResolvedValue({ Id: 1, BypassAllAssembly: true });
    await controller.update(dto, user);
    expect(service.update).toHaveBeenCalledWith(dto, 'admin');
  });

  it('validates boolean, timestamp, and reason fields', async () => {
    const dto = Object.assign(new UpdateAssemblyProcessSettingDto(), {
      bypassAllAssembly: 'yes',
      expectedUpdatedAt: 'not-a-date',
      reason: 'x',
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property).sort()).toEqual([
      'bypassAllAssembly',
      'expectedUpdatedAt',
      'reason',
    ]);
  });
});
