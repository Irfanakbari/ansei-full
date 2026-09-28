import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { PrintAgentAuthGuard } from './print-agent-auth.guard';

describe('PrintAgentAuthGuard', () => {
  it('rejects a decorated runtime route with no agent credential', async () => {
    const guard = new PrintAgentAuthGuard({} as never);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
