import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { CreateEmailNotificationDto, UpdateEmailNotificationDto } from './dto';
import type {
  LogProcessModel,
  EmailNotificationModel,
} from '../../generated/prisma/models';

@Injectable()
export class EmailNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  async findAll(): Promise<EmailNotificationModel[]> {
    return this.prisma.emailNotification.findMany({
      orderBy: { Id: 'asc' },
    });
  }

  async findOne(id: number): Promise<EmailNotificationModel> {
    const result = await this.prisma.emailNotification.findUnique({
      where: { Id: id },
    });

    if (!result) {
      throw new NotFoundException(`EmailNotification with id ${id} not found`);
    }

    return result;
  }

  async findByEmail(email: string): Promise<EmailNotificationModel> {
    const result = await this.prisma.emailNotification.findFirst({
      where: { Email: email },
    });

    if (!result) {
      throw new NotFoundException(
        `EmailNotification with email ${email} not found`,
      );
    }

    return result;
  }

  async create(
    dto: CreateEmailNotificationDto,
  ): Promise<EmailNotificationModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'EMAIL_001',
        functionName: 'EmailNotificationService.Create',
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating email notification: ${dto.email}`,
        type: 'INFO',
        location: 'email-notification.service.ts:45',
      });

      // Check if email already exists
      const existing = await this.prisma.emailNotification.findFirst({
        where: { Email: dto.email },
      });

      if (existing) {
        throw new ConflictException(
          `EmailNotification with email ${dto.email} already exists`,
        );
      }

      const result = await this.prisma.emailNotification.create({
        data: {
          Name: dto.name,
          Email: dto.email,
          Type: dto.type ?? 'DEFAULT',
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `EmailNotification created successfully with id: ${result.Id}`,
        type: 'INFO',
        location: 'email-notification.service.ts:62',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'email-notification.service.ts:74',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateEmailNotificationDto,
  ): Promise<EmailNotificationModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'EMAIL_002',
        functionName: 'EmailNotificationService.Update',
      });

      const existing = await this.prisma.emailNotification.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(
          `EmailNotification with id ${id} not found`,
        );
      }

      // Check if new email conflicts with existing
      if (dto.email && dto.email !== existing.Email) {
        const emailConflict = await this.prisma.emailNotification.findFirst({
          where: { Email: dto.email },
        });

        if (emailConflict) {
          throw new ConflictException(
            `EmailNotification with email ${dto.email} already exists`,
          );
        }
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating email notification id: ${id} with data: ${JSON.stringify(dto)}`,
        type: 'INFO',
        location: 'email-notification.service.ts:104',
      });

      const result = await this.prisma.emailNotification.update({
        where: { Id: id },
        data: {
          Name: dto.name,
          Email: dto.email,
          Type: dto.type,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `EmailNotification updated successfully: ${result.Id}`,
        type: 'INFO',
        location: 'email-notification.service.ts:119',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'email-notification.service.ts:131',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'EMAIL_003',
        functionName: 'EmailNotificationService.Delete',
      });

      const existing = await this.prisma.emailNotification.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(
          `EmailNotification with id ${id} not found`,
        );
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting email notification id: ${id}`,
        type: 'INFO',
        location: 'email-notification.service.ts:151',
      });

      await this.prisma.emailNotification.delete({
        where: { Id: id },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `EmailNotification deleted successfully: ${id}`,
        type: 'INFO',
        location: 'email-notification.service.ts:159',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { deleted: true, id };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'email-notification.service.ts:171',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
