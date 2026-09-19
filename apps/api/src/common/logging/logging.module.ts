import { Global, Module } from '@nestjs/common';
import { OriginalErrorFileLogService } from './original-error-file-log.service';
import { ActionAuditService } from './action-audit.service';

@Global()
@Module({
  providers: [OriginalErrorFileLogService, ActionAuditService],
  exports: [OriginalErrorFileLogService, ActionAuditService],
})
export class LoggingModule {}
