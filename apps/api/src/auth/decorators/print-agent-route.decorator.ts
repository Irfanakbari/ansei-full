import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { PrintAgentAuthGuard } from '../../settings/print-agent/print-agent-auth.guard';

export const IS_PRINT_AGENT_ROUTE = 'isPrintAgentRoute';
export const PrintAgentRoute = () =>
  applyDecorators(
    SetMetadata(IS_PRINT_AGENT_ROUTE, true),
    UseGuards(PrintAgentAuthGuard),
  );
