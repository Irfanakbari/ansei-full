import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { InventoryCountingDocumentService } from './inventory-counting-document.service';
import {
  ItemCategory,
  LocationType,
  OpnameStatus,
} from '../generated/prisma/enums';
import type { PrismaService } from '../prisma/prisma.service';
import type { NasUploadService } from '../common/utils/nas-upload.service';

jest.mock('../common/utils/document-converter.util', () => ({
  excelToPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
}));

interface Fixture {
  service: InventoryCountingDocumentService;
  prisma: {
    stockOpname: { findUnique: jest.Mock };
    stockOpnameAttachment: { findFirst: jest.Mock; create: jest.Mock };
  };
  nas: {
    uploadFile: jest.Mock;
    deleteFile: jest.Mock;
    downloadFile: jest.Mock;
  };
}

function fixture(): Fixture {
  const prisma = {
    stockOpname: { findUnique: jest.fn() },
    stockOpnameAttachment: {
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue({ Id: 1, FileName: 'package.zip' }),
    },
  };
  const nas = {
    uploadFile: jest
      .fn()
      .mockResolvedValue('https://files.example/package.zip'),
    deleteFile: jest.fn(),
    downloadFile: jest.fn(),
  };
  return {
    service: new InventoryCountingDocumentService(
      prisma as unknown as PrismaService,
      nas as unknown as NasUploadService,
    ),
    prisma,
    nas,
  };
}

function startedMaterial() {
  return {
    Id: 'sto-1',
    RecordNumber: 'STO/001',
    Category: ItemCategory.MATERIAL,
    Status: OpnameStatus.IN_PROGRESS,
    StartedAt: new Date('2026-09-29T00:00:00.000Z'),
    Details: [
      {
        Location: LocationType.WAREHOUSE,
        MaterialId: 'MAT-001',
        MaterialData: { PartName: 'Material One', RackLocation: 'R-01' },
      },
      {
        Location: LocationType.RACK,
        MaterialId: 'MAT-001',
        MaterialData: { PartName: 'Material One', RackLocation: 'R-01' },
      },
    ],
  };
}

describe('InventoryCountingDocumentService', () => {
  it('rejects package generation unless MATERIAL is started and IN_PROGRESS', async () => {
    const f = fixture();
    f.prisma.stockOpname.findUnique.mockResolvedValue({
      ...startedMaterial(),
      Status: OpnameStatus.DRAFT,
      StartedAt: null,
    });

    await expect(
      f.service.buildAndPersist('sto-1', 'counter', Buffer.from('snapshot')),
    ).rejects.toThrow(BadRequestException);
    expect(f.nas.uploadFile).not.toHaveBeenCalled();
  });

  it('packages the supplied established snapshot workbook unchanged', async () => {
    const f = fixture();
    f.prisma.stockOpname.findUnique.mockResolvedValue(startedMaterial());
    const snapshotWorkbook = new Workbook();
    snapshotWorkbook.addWorksheet('Snapshot').addRow(['existing-contract']);
    const snapshot = Buffer.from(await snapshotWorkbook.xlsx.writeBuffer());
    const zipSpy = jest
      .spyOn(f.service as never, 'zip')
      .mockImplementation((files: Array<{ name: string; content: Buffer }>) => {
        const snapshotFile = files.find(
          (file) =>
            file.name.startsWith('Stock_Snapshot_') &&
            file.name.endsWith('.xlsx'),
        );
        expect(snapshotFile?.content).toEqual(snapshot);
        return Promise.resolve(Buffer.from('zip'));
      });

    await f.service.buildAndPersist('sto-1', 'counter', snapshot);

    expect(zipSpy).toHaveBeenCalled();
    expect(f.prisma.stockOpnameAttachment.create).toHaveBeenCalled();
    expect(f.nas.deleteFile).not.toHaveBeenCalled();
  });

  it('removes only the newly uploaded orphan when metadata persistence fails', async () => {
    const f = fixture();
    f.prisma.stockOpname.findUnique.mockResolvedValue(startedMaterial());
    f.prisma.stockOpnameAttachment.create.mockRejectedValue(
      new Error('database unavailable'),
    );
    jest.spyOn(f.service as never, 'zip').mockResolvedValue(Buffer.from('zip'));

    await expect(
      f.service.buildAndPersist('sto-1', 'counter', Buffer.from('snapshot')),
    ).rejects.toThrow('database unavailable');

    expect(f.nas.deleteFile).toHaveBeenCalledWith(
      'https://files.example/package.zip',
    );
  });
});
