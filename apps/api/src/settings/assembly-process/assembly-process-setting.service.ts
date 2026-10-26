import { ConflictException, Injectable } from '@nestjs/common';
import { auditedTransaction } from '../../common/helpers/audited-transaction.helper';
import { lockProductionFlow } from '../../common/helpers/production-flow.helper';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateAssemblyProcessSettingDto } from './dto/update-assembly-process-setting.dto';

const SETTING_ID = 1;

@Injectable()
export class AssemblyProcessSettingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly log: LogProcessService,
  ) {}

  find() {
    return this.prisma.assemblyProcessSetting.findUniqueOrThrow({
      where: { Id: SETTING_ID },
    });
  }

  async update(dto: UpdateAssemblyProcessSettingDto, actor: string) {
    const process = await this.log.startProcess({
      functionId: 'ASSEMBLY_SETTING_UPDATE',
      functionName: 'AssemblyProcessSettingService.Update',
      createdBy: actor,
    });
    try {
      return await auditedTransaction(this.prisma, async (tx) => {
        await lockProductionFlow(tx);
        const updated = await tx.assemblyProcessSetting.updateMany({
          where: {
            Id: SETTING_ID,
            UpdatedAt: new Date(dto.expectedUpdatedAt),
          },
          data: {
            BypassAllAssembly: dto.bypassAllAssembly,
            ChangeReason: dto.reason.trim(),
            UpdatedBy: actor,
          },
        });
        if (updated.count !== 1)
          throw new ConflictException(
            'Assembly process setting changed. Refresh before updating.',
          );
        const result = await tx.assemblyProcessSetting.findUniqueOrThrow({
          where: { Id: SETTING_ID },
        });
        await this.log.addLog({
          processId: process.ProcessId,
          message: `Assembly bypass setting changed to ${result.BypassAllAssembly ? 'enabled' : 'disabled'}. Reason: ${result.ChangeReason}`,
          type: 'INFO',
          location: 'AssemblyProcessSettingService.update',
          client: tx,
        });
        await this.log.completeProcess(
          process.ProcessId,
          'SUCCESS',
          undefined,
          tx,
        );
        return result;
      });
    } catch (error) {
      await this.log.completeProcess(process.ProcessId, 'FAILED');
      throw error;
    }
  }
}
