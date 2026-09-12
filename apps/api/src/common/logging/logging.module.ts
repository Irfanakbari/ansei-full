import { Global, Module } from '@nestjs/common';
import { OriginalErrorFileLogService } from './original-error-file-log.service';

@Global()
@Module({
  providers: [OriginalErrorFileLogService],
  exports: [OriginalErrorFileLogService],
})
export class LoggingModule {}
