import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LogProcessService } from '../../../common/log-process/log-process.service';
import { CreateBillOfMaterialsDto, UpdateBillOfMaterialsDto } from './dto';
import type {
  LogProcessModel,
  BillOfMaterialsModel,
} from '../../../generated/prisma/models';

@Injectable()
export class BillOfMaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  async findAll(): Promise<BillOfMaterialsModel[]> {
    return this.prisma.billOfMaterials.findMany({
      include: {
        FGData: true,
        MaterialData: true,
      },
      orderBy: { Id: 'asc' },
    });
  }

  async findByFinishGoodId(
    finishGoodId: number,
  ): Promise<BillOfMaterialsModel[]> {
    const results = await this.prisma.billOfMaterials.findMany({
      where: { FinishGoodId: finishGoodId },
      include: {
        FGData: true,
        MaterialData: true,
      },
      orderBy: { Id: 'asc' },
    });

    return results;
  }

  async findByMaterialId(materialId: number): Promise<BillOfMaterialsModel[]> {
    const results = await this.prisma.billOfMaterials.findMany({
      where: { MaterialId: materialId },
      include: {
        FGData: true,
        MaterialData: true,
      },
      orderBy: { Id: 'asc' },
    });

    return results;
  }

  async create(
    dto: CreateBillOfMaterialsDto,
    createdBy: string,
  ): Promise<BillOfMaterialsModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'BOM_001',
        functionName: 'BillOfMaterialsService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating bill of materials: MaterialId=${dto.materialId}, FinishGoodId=${dto.finishGoodId}, Qty=${dto.qty}`,
        type: 'INFO',
        location: 'bill-of-materials.service.ts:50',
      });

      // Check if Material exists
      const material = await this.prisma.material.findUnique({
        where: { Id: dto.materialId },
      });

      if (!material) {
        throw new NotFoundException(
          `Material with id ${dto.materialId} not found`,
        );
      }

      // Check if FinishGood exists
      const finishGood = await this.prisma.finishGood.findUnique({
        where: { Id: dto.finishGoodId },
      });

      if (!finishGood) {
        throw new NotFoundException(
          `FinishGood with id ${dto.finishGoodId} not found`,
        );
      }

      // Check if BOM already exists (unique constraint)
      const existing = await this.prisma.billOfMaterials.findFirst({
        where: {
          FinishGoodId: dto.finishGoodId,
          MaterialId: dto.materialId,
        },
      });

      if (existing) {
        throw new ConflictException(
          `BillOfMaterials with FinishGoodId=${dto.finishGoodId} and MaterialId=${dto.materialId} already exists`,
        );
      }

      const result = await this.prisma.billOfMaterials.create({
        data: {
          MaterialId: dto.materialId,
          FinishGoodId: dto.finishGoodId,
          Qty: dto.qty,
        },
        include: {
          FGData: true,
          MaterialData: true,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `BillOfMaterials created successfully with id: ${result.Id}`,
        type: 'INFO',
        location: 'bill-of-materials.service.ts:90',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'bill-of-materials.service.ts:102',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateBillOfMaterialsDto,
    createdBy: string,
  ): Promise<BillOfMaterialsModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'BOM_002',
        functionName: 'BillOfMaterialsService.Update',
        createdBy,
      });

      const existing = await this.prisma.billOfMaterials.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`BillOfMaterials with id ${id} not found`);
      }

      // Check for unique constraint conflict if changing FinishGoodId or MaterialId
      if (
        (dto.finishGoodId && dto.finishGoodId !== existing.FinishGoodId) ||
        (dto.materialId && dto.materialId !== existing.MaterialId)
      ) {
        const newFinishGoodId = dto.finishGoodId ?? existing.FinishGoodId;
        const newMaterialId = dto.materialId ?? existing.MaterialId;

        const conflict = await this.prisma.billOfMaterials.findFirst({
          where: {
            Id: { not: id },
            FinishGoodId: newFinishGoodId,
            MaterialId: newMaterialId,
          },
        });

        if (conflict) {
          throw new ConflictException(
            `BillOfMaterials with FinishGoodId=${newFinishGoodId} and MaterialId=${newMaterialId} already exists`,
          );
        }
      }

      // Validate MaterialId if provided
      if (dto.materialId) {
        const material = await this.prisma.material.findUnique({
          where: { Id: dto.materialId },
        });

        if (!material) {
          throw new NotFoundException(
            `Material with id ${dto.materialId} not found`,
          );
        }
      }

      // Validate FinishGoodId if provided
      if (dto.finishGoodId) {
        const finishGood = await this.prisma.finishGood.findUnique({
          where: { Id: dto.finishGoodId },
        });

        if (!finishGood) {
          throw new NotFoundException(
            `FinishGood with id ${dto.finishGoodId} not found`,
          );
        }
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Updating bill of materials id: ${id} with data: ${JSON.stringify(dto)}`,
        type: 'INFO',
        location: 'bill-of-materials.service.ts:158',
      });

      const result = await this.prisma.billOfMaterials.update({
        where: { Id: id },
        data: {
          MaterialId: dto.materialId,
          FinishGoodId: dto.finishGoodId,
          Qty: dto.qty,
        },
        include: {
          FGData: true,
          MaterialData: true,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `BillOfMaterials updated successfully: ${result.Id}`,
        type: 'INFO',
        location: 'bill-of-materials.service.ts:176',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'bill-of-materials.service.ts:188',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async remove(
    id: number,
    createdBy: string,
  ): Promise<{ deleted: boolean; id: number }> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'BOM_003',
        functionName: 'BillOfMaterialsService.Delete',
        createdBy,
      });

      const existing = await this.prisma.billOfMaterials.findUnique({
        where: { Id: id },
      });

      if (!existing) {
        throw new NotFoundException(`BillOfMaterials with id ${id} not found`);
      }

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Deleting bill of materials id: ${id}`,
        type: 'INFO',
        location: 'bill-of-materials.service.ts:209',
      });

      await this.prisma.billOfMaterials.delete({
        where: { Id: id },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `BillOfMaterials deleted successfully: ${id}`,
        type: 'INFO',
        location: 'bill-of-materials.service.ts:217',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { deleted: true, id };
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'bill-of-materials.service.ts:229',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
