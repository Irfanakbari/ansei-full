import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const mockContext = (user: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext;

  it('allows access when no permissions are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = mockContext({
      username: 'user1',
      permissions: [],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('bypasses checks for SUPER_ADMINISTRATOR in globalRoles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['IPCS.MASTER_CREATE']);

    const context = mockContext({
      username: 'super-user',
      globalRoles: ['SUPER_ADMINISTRATOR'],
      permissions: [],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows RO_ADMINISTRATOR to access read-only endpoints', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['IPCS.MASTER_READ']);

    const context = mockContext({
      username: 'ro-user',
      globalRoles: ['RO_ADMINISTRATOR'],
      roleName: 'READONLY',
      permissions: ['IPCS.MASTER_READ'],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows RO_ADMINISTRATOR to access dashboard view', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['DASHBOARD_VIEW']);

    const context = mockContext({
      username: 'ro-user',
      globalRoles: ['RO_ADMINISTRATOR'],
      roleName: 'READONLY',
      permissions: ['DASHBOARD_VIEW'],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies RO_ADMINISTRATOR from accessing mutate/create endpoints', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['IPCS.MASTER_CREATE']);

    const context = mockContext({
      username: 'ro-user',
      globalRoles: ['RO_ADMINISTRATOR'],
      roleName: 'READONLY',
      permissions: ['IPCS.MASTER_READ'],
    });

    expect(guard.canActivate(context)).toBe(false);
  });

  it('denies RO_ADMINISTRATOR from accessing delete endpoints', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['IPCS.MASTER_DELETE']);

    const context = mockContext({
      username: 'ro-user',
      globalRoles: ['RO_ADMINISTRATOR'],
      roleName: 'READONLY',
      permissions: ['IPCS.MASTER_READ'],
    });

    expect(guard.canActivate(context)).toBe(false);
  });
});
