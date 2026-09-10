import { Module } from '@nestjs/common';
import { SystemLogService } from './system-log.service';
import { SystemLogController } from './system-log.controller';

@Module({
  controllers: [SystemLogController],
  providers: [SystemLogService],
})
export class SystemLogModule {}
