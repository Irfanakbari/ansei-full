import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  BomRevisionStatus,
  ItemCategory,
  LocationType,
  NotificationType,
  TransactionType,
} from '../src/generated/prisma/enums';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const ACTOR = 'seed-dummy';
const DUMMY_PREFIX = 'DM-';
const INITIAL_RACK_QTY = 10_000;
const INITIAL_WAREHOUSE_QTY = 1_000;

function deterministicUuid(kind: number, row: number): string {
  return `00000000-0000-4${kind.toString(16).padStart(3, '0')}-8000-${row.toString(16).padStart(12, '0')}`;
}

async function clearSeededTables(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ActionAuditEvent",
      "LogProcessDetail",
      "LogProcess",
      "BusinessCommand",
      "ProductionTraceEvent",
      "ProductionBomSnapshotLine",
      "ProductionBomSnapshot",
      "BomRevisionEvent",
      "BomRevisionLine",
      "BomRevision",
      "InventoryLedger",
      "BillOfMaterials",
      "BoxQTY",
      "Forecast",
      "LineStatus",
      "ManPower",
      "Material",
      "FinishGood",
      "Supplier",
      "Satuan",
      "EmailNotification",
      "DashboardSetting",
      "PrintJobEvent",
      "PrintJob",
      "ProfilePrinter",
      "PrintAgentCredential",
      "PrintAgentEnrollment",
      "PrintAgent",
      "DisplayConfig"
    RESTART IDENTITY CASCADE
  `);
}

const units = ['PCS', 'SET', 'KG', 'METER', 'GRAM', 'LITER', 'ROLL'];
const suppliers = [
  'PT Dummy Fastener Indonesia',
  'PT Dummy Resin Components',
  'PT Dummy Metal Press',
  'PT Dummy Rubber Industries',
  'PT Dummy Electrical Components',
  'PT Dummy Packaging',
  'PT Dummy Cable Manufacturing',
  'PT Dummy Chemical Supply',
];
const materialFamilies = [
  ['FAST', 'Bolt M6 x 20'],
  ['FAST', 'Screw M4 x 12'],
  ['FAST', 'Nut M6'],
  ['FAST', 'Washer M6'],
  ['FAST', 'Spring Clip'],
  ['METAL', 'Bracket Upper'],
  ['METAL', 'Bracket Lower'],
  ['METAL', 'Back Plate'],
  ['METAL', 'Lever Arm'],
  ['METAL', 'Guide Rod'],
  ['RESIN', 'Main Housing'],
  ['RESIN', 'Front Cover'],
  ['RESIN', 'Rear Cover'],
  ['RESIN', 'Latch Housing'],
  ['RESIN', 'Button Cap'],
  ['RUBBER', 'Rubber Pad'],
  ['RUBBER', 'Dust Seal'],
  ['RUBBER', 'Grommet'],
  ['RUBBER', 'O-Ring'],
  ['RUBBER', 'Cable Seal'],
  ['ELEC', 'Cable 2 Core'],
  ['ELEC', 'Connector 2P'],
  ['ELEC', 'Connector 4P'],
  ['ELEC', 'Terminal'],
  ['ELEC', 'Cable Tie'],
  ['CONS', 'Industrial Adhesive'],
  ['CONS', 'Double Tape'],
  ['CONS', 'Warning Label'],
  ['PACK', 'Inner Tray'],
  ['PACK', 'Poly Bag'],
] as const;

function dateUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
function deterministicBox(index: number): number {
  return index % 3 === 0 ? 32 : 16;
}
function nextUniqueMaterialIndex(
  existing: number[],
  candidate: number,
): number {
  let index = candidate % materialFamilies.length;
  while (existing.includes(index)) {
    index = (index + 1) % materialFamilies.length;
  }
  return index;
}
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  console.log('Clearing all seeded tables and dependent data');
  await clearSeededTables();
  console.log('Starting dummy seed with initial material stock');

  const unitMap = new Map<string, number>();
  for (const name of units) {
    const existing = await prisma.satuan.findFirst({ where: { Name: name } });
    const row =
      existing ??
      (await prisma.satuan.create({
        data: { Name: name, CreatedBy: ACTOR, UpdatedBy: ACTOR },
      }));
    unitMap.set(name, row.Id);
  }

  for (const name of suppliers) {
    const existing = await prisma.supplier.findFirst({ where: { Name: name } });
    if (!existing)
      await prisma.supplier.create({
        data: { Name: name, CreatedBy: ACTOR, UpdatedBy: ACTOR },
      });
  }

  const materials = [] as Awaited<ReturnType<typeof prisma.material.upsert>>[];
  for (let index = 0; index < materialFamilies.length; index += 1) {
    const [family, label] = materialFamilies[index];
    const partNumber = `${DUMMY_PREFIX}MAT-${String(index + 1).padStart(3, '0')}`;
    const supplier = suppliers[index % suppliers.length];
    const unit = family === 'CONS' ? 'GRAM' : family === 'PACK' ? 'SET' : 'PCS';
    const material = await prisma.material.upsert({
      where: { PartNumber: partNumber },
      update: {
        PartName: label,
        Supplier: supplier,
        SatuanId: unitMap.get(unit),
        RackLocation: `DM-${String.fromCharCode(65 + (index % 4))}-${String(index + 1).padStart(2, '0')}`,
        IsActive: true,
        DiscontinueDate: null,
        UpdatedBy: ACTOR,
      },
      create: {
        PartNumber: partNumber,
        PartName: label,
        CreatedBy: ACTOR,
        UpdatedBy: ACTOR,
        Supplier: supplier,
        SatuanId: unitMap.get(unit),
        RackLocation: `DM-${String.fromCharCode(65 + (index % 4))}-${String(index + 1).padStart(2, '0')}`,
        IsActive: true,
        QtyRack: INITIAL_RACK_QTY,
        QtyWarehouse: INITIAL_WAREHOUSE_QTY,
      },
    });
    materials.push(material);

    await prisma.inventoryLedger.createMany({
      data: [
        {
          ItemCategory: ItemCategory.MATERIAL,
          MaterialId: partNumber,
          Location: LocationType.RACK,
          TransactionType: TransactionType.ADJUSTMENT_MANUAL,
          ReferenceDoc: `${DUMMY_PREFIX}INITIAL-STOCK-RACK`,
          BalanceBefore: 0,
          QtyIn: INITIAL_RACK_QTY,
          QtyOut: 0,
          BalanceAfter: INITIAL_RACK_QTY,
          CreatedBy: ACTOR,
          Notes: 'Initial rack stock for dummy production simulation',
        },
        {
          ItemCategory: ItemCategory.MATERIAL,
          MaterialId: partNumber,
          Location: LocationType.WAREHOUSE,
          TransactionType: TransactionType.ADJUSTMENT_MANUAL,
          ReferenceDoc: `${DUMMY_PREFIX}INITIAL-STOCK-WAREHOUSE`,
          BalanceBefore: 0,
          QtyIn: INITIAL_WAREHOUSE_QTY,
          QtyOut: 0,
          BalanceAfter: INITIAL_WAREHOUSE_QTY,
          CreatedBy: ACTOR,
          Notes: 'Initial warehouse stock for dummy production simulation',
        },
      ],
    });
  }

  const finishGoods = [] as Awaited<
    ReturnType<typeof prisma.finishGood.upsert>
  >[];
  for (let index = 0; index < 30; index += 1) {
    const partNumber = `${DUMMY_PREFIX}FG-${String(index + 1).padStart(3, '0')}`;
    const fg = await prisma.finishGood.upsert({
      where: { PartNumber: partNumber },
      update: {
        PartName: `Dummy Product Family ${String.fromCharCode(65 + (index % 6))} Variant ${index + 1}`,
        Price: 25000 + index * 3750,
        UpdatedBy: ACTOR,
      },
      create: {
        PartNumber: partNumber,
        PartName: `Dummy Product Family ${String.fromCharCode(65 + (index % 6))} Variant ${index + 1}`,
        Price: 25000 + index * 3750,
        CreatedBy: ACTOR,
        UpdatedBy: ACTOR,
        Qty: 0,
      },
    });
    finishGoods.push(fg);
    await prisma.boxQTY.upsert({
      where: { PartNumber: partNumber },
      update: { Qty: deterministicBox(index), UpdatedBy: ACTOR },
      create: {
        PartNumber: partNumber,
        Qty: deterministicBox(index),
        CreatedBy: ACTOR,
        UpdatedBy: ACTOR,
      },
    });
  }

  const bomSeedBase = dateUtc('2026-01-01');
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('ansei.actor', ${ACTOR}, true), set_config('ansei.request_id', ${'seed-dummy-bom-revisions'}, true), set_config('ansei.process_id', ${''}, true)`;
    for (let fgIndex = 0; fgIndex < finishGoods.length; fgIndex += 1) {
      const maker = `${ACTOR}-maker-${String((fgIndex % 3) + 1).padStart(2, '0')}`;
      const checker = `${ACTOR}-checker-${String((fgIndex % 3) + 1).padStart(2, '0')}`;
      const revisionIds = [1, 2, 3].map((revision) =>
        deterministicUuid(revision, fgIndex + 1),
      );
      const baselineMaterialIndexes = Array.from(
        { length: 5 },
        (_, offset) => (fgIndex * 3 + offset * 7) % materials.length,
      );
      const activeMaterialIndexes = [
        ...baselineMaterialIndexes.slice(0, 4),
        nextUniqueMaterialIndex(
          baselineMaterialIndexes.slice(0, 4),
          baselineMaterialIndexes[4] + 1,
        ),
      ];
      const draftMaterialIndexes = [
        ...activeMaterialIndexes.slice(0, 4),
        nextUniqueMaterialIndex(
          activeMaterialIndexes.slice(0, 4),
          activeMaterialIndexes[4] + 1,
        ),
      ];
      const revisionMaterialIndexes = [
        baselineMaterialIndexes,
        activeMaterialIndexes,
        draftMaterialIndexes,
      ];
      const createdTimes = [0, 30, 60].map((days) =>
        addDays(bomSeedBase, fgIndex + days),
      );

      for (let revisionIndex = 0; revisionIndex < 3; revisionIndex += 1) {
        const revision = revisionIndex + 1;
        const revisionId = revisionIds[revisionIndex];
        const createdAt = createdTimes[revisionIndex];
        const materialIndexes = revisionMaterialIndexes[revisionIndex];
        const reason =
          revision === 1
            ? 'Historical baseline import'
            : revision === 2
              ? 'Approved component and quantity change'
              : 'Pending deterministic engineering change';
        await tx.bomRevision.create({
          data: {
            Id: revisionId,
            FinishGoodId: finishGoods[fgIndex].Id,
            Revision: revision,
            BaseRevisionId:
              revision === 1 ? null : revisionIds[revisionIndex - 1],
            Reason: reason,
            Version: 1,
            CreatedBy: maker,
            LastEditedBy: maker,
            CreatedAt: createdAt,
            Lines: {
              create: materialIndexes.map((materialIndex, lineIndex) => ({
                Id: deterministicUuid(
                  revision + 3,
                  fgIndex * 15 + revisionIndex * 5 + lineIndex + 1,
                ),
                MaterialId: materials[materialIndex].Id,
                Qty:
                  1 +
                  ((fgIndex +
                    materialIndex +
                    (revision > 1 && lineIndex === 0 ? 1 : 0)) %
                    8),
                PartNumber: materials[materialIndex].PartNumber,
                PartName: materials[materialIndex].PartName,
                UnitName:
                  materialFamilies[materialIndex][0] === 'CONS'
                    ? 'GRAM'
                    : materialFamilies[materialIndex][0] === 'PACK'
                      ? 'SET'
                      : 'PCS',
              })),
            },
            Events: {
              create: {
                Id: deterministicUuid(
                  revision + 6,
                  fgIndex * 9 + revisionIndex * 3 + 1,
                ),
                Action: revision === 1 ? 'BASELINE_IMPORTED' : 'CREATED',
                Actor: maker,
                Reason: reason,
                Version: 1,
                CreatedAt: createdAt,
              },
            },
          },
        });

        const finalStatus =
          revision < 3
            ? BomRevisionStatus.APPROVED
            : fgIndex < 10
              ? BomRevisionStatus.DRAFT
              : fgIndex < 20
                ? BomRevisionStatus.SUBMITTED
                : BomRevisionStatus.CANCELLED;
        if (finalStatus === BomRevisionStatus.DRAFT) continue;

        if (finalStatus === BomRevisionStatus.CANCELLED) {
          const cancelledAt = addDays(createdAt, 1);
          await tx.bomRevision.update({
            where: { Id: revisionId },
            data: {
              Status: BomRevisionStatus.CANCELLED,
              Version: 2,
              Events: {
                create: {
                  Id: deterministicUuid(
                    revision + 12,
                    fgIndex * 9 + revisionIndex * 3 + 3,
                  ),
                  Action: 'CANCEL',
                  Actor: maker,
                  Reason: reason,
                  Version: 2,
                  CreatedAt: cancelledAt,
                },
              },
            },
          });
          continue;
        }

        const submittedAt = addDays(createdAt, 1);
        await tx.bomRevision.update({
          where: { Id: revisionId },
          data: {
            Status: BomRevisionStatus.SUBMITTED,
            Version: 2,
            SubmittedBy: maker,
            SubmittedAt: submittedAt,
            Events: {
              create: {
                Id: deterministicUuid(
                  revision + 9,
                  fgIndex * 9 + revisionIndex * 3 + 2,
                ),
                Action: 'SUBMIT',
                Actor: maker,
                Reason: reason,
                Version: 2,
                CreatedAt: submittedAt,
              },
            },
          },
        });
        if (finalStatus === BomRevisionStatus.SUBMITTED) continue;

        const transitionedAt = addDays(createdAt, 2);
        await tx.bomRevision.update({
          where: { Id: revisionId },
          data: {
            Status: BomRevisionStatus.APPROVED,
            Version: 3,
            ApprovedBy: checker,
            ApprovedAt: transitionedAt,
            Events: {
              create: {
                Id: deterministicUuid(
                  revision + 12,
                  fgIndex * 9 + revisionIndex * 3 + 3,
                ),
                Action: 'APPROVE',
                Actor: checker,
                Reason: reason,
                Version: 3,
                CreatedAt: transitionedAt,
              },
            },
          },
        });
      }

      await tx.finishGood.update({
        where: { Id: finishGoods[fgIndex].Id },
        data: { ActiveBomRevisionId: revisionIds[1], UpdatedBy: ACTOR },
      });
      const activeLines = await tx.bomRevisionLine.findMany({
        where: { RevisionId: revisionIds[1] },
      });
      await tx.billOfMaterials.createMany({
        data: activeLines.map((line) => ({
          FinishGoodId: finishGoods[fgIndex].Id,
          MaterialId: line.MaterialId,
          Qty: line.Qty,
        })),
      });
    }
  });

  for (let index = 0; index < 16; index += 1) {
    const nik = `${DUMMY_PREFIX}EMP-${String(index + 1).padStart(3, '0')}`;
    await prisma.manPower.upsert({
      where: { Nik: nik },
      update: {
        Name: `Dummy Operator ${index + 1}`,
        Line: `LINE-${String.fromCharCode(65 + (index % 4))}`,
        Status: index !== 15,
        UpdatedBy: ACTOR,
      },
      create: {
        Nik: nik,
        Name: `Dummy Operator ${index + 1}`,
        Line: `LINE-${String.fromCharCode(65 + (index % 4))}`,
        Status: index !== 15,
        CreatedBy: ACTOR,
        UpdatedBy: ACTOR,
      },
    });
  }

  for (let index = 0; index < finishGoods.length; index += 1) {
    const lineName = `DUMMY-LINE-${String(index + 1).padStart(2, '0')}`;
    const existingLine = await prisma.lineStatus.findFirst({
      where: { LineName: lineName },
    });
    if (!existingLine) {
      await prisma.lineStatus.create({
        data: {
          LineName: lineName,
          FinishGoodId: finishGoods[index].PartNumber,
        },
      });
    } else {
      await prisma.lineStatus.update({
        where: { Id: existingLine.Id },
        data: { FinishGoodId: finishGoods[index].PartNumber },
      });
    }
  }

  const forecastCountByMonth = { September: 0, October: 0 };
  let forecastIndex = 1;
  for (let month = 9; month <= 10; month += 1) {
    const monthStart = dateUtc(`2026-${String(month).padStart(2, '0')}-01`);
    const daysInMonth = month === 9 ? 30 : 31;
    for (let fgIndex = 0; fgIndex < finishGoods.length; fgIndex += 1) {
      for (let occurrence = 0; occurrence < 2; occurrence += 1) {
        const day = 1 + ((fgIndex * 2 + occurrence * 11) % daysInMonth);
        const deliveryDate = addDays(monthStart, day - 1);
        const boxQty = deterministicBox(fgIndex);
        const qty = boxQty * (2 + ((fgIndex + occurrence) % 10));
        const sequence = String(forecastIndex).padStart(4, '0');
        const poId = `${DUMMY_PREFIX}FC-2026${String(month).padStart(2, '0')}-${sequence}`;
        await prisma.forecast.upsert({
          where: { PoId: poId },
          update: {
            Date: addDays(deliveryDate, -14),
            VendorCode: `DUMMY-CUST-${(fgIndex % 4) + 1}`,
            VendorName: `Dummy Customer ${(fgIndex % 4) + 1}`,
            ReceivingArea: `DOCK-${String.fromCharCode(65 + (fgIndex % 3))}`,
            DeliveryDate: deliveryDate,
            DeliveryPeriod: Math.floor((day - 1) / 7) + 1,
            Classification: 'REGULER',
            PoNumber: `${DUMMY_PREFIX}PO-2026${String(month).padStart(2, '0')}-${String(fgIndex + 1).padStart(3, '0')}`,
            Item: occurrence + 1,
            Qty: qty,
            FinishGoodId: finishGoods[fgIndex].PartNumber,
          },
          create: {
            PoId: poId,
            Date: addDays(deliveryDate, -14),
            VendorCode: `DUMMY-CUST-${(fgIndex % 4) + 1}`,
            VendorName: `Dummy Customer ${(fgIndex % 4) + 1}`,
            ReceivingArea: `DOCK-${String.fromCharCode(65 + (fgIndex % 3))}`,
            DeliveryDate: deliveryDate,
            DeliveryPeriod: Math.floor((day - 1) / 7) + 1,
            Classification: 'REGULER',
            PoNumber: `${DUMMY_PREFIX}PO-2026${String(month).padStart(2, '0')}-${String(fgIndex + 1).padStart(3, '0')}`,
            Item: occurrence + 1,
            Qty: qty,
            FinishGoodId: finishGoods[fgIndex].PartNumber,
          },
        });
        if (month === 9) forecastCountByMonth.September += 1;
        else forecastCountByMonth.October += 1;
        forecastIndex += 1;
      }
    }
  }

  const settingsMarker = '[DUMMY]';
  const email = await prisma.emailNotification.findFirst({
    where: { Email: 'dummy-operations@example.invalid' },
  });
  if (!email)
    await prisma.emailNotification.create({
      data: {
        Name: `${settingsMarker} Operations`,
        Email: 'dummy-operations@example.invalid',
        Type: NotificationType.DEFAULT,
        CreatedBy: ACTOR,
        UpdatedBy: ACTOR,
      },
    });
  const dashboard = await prisma.dashboardSetting.findFirst();
  if (!dashboard)
    await prisma.dashboardSetting.create({
      data: {
        StartDate: dateUtc('2026-09-01'),
        EndDate: new Date('2026-10-31T23:59:59.999Z'),
        UpdatedAt: new Date(),
      },
    });
  const display = await prisma.displayConfig.findFirst({
    where: { Description: `${settingsMarker} Production Display` },
  });
  if (!display)
    await prisma.displayConfig.create({
      data: {
        Description: `${settingsMarker} Production Display`,
        Url: '/apps/production/display',
        IsOpen: false,
        Loop: true,
        CreatedBy: ACTOR,
        UpdatedBy: ACTOR,
      },
    });

  assert(materials.length === 30, 'Expected 30 materials');
  assert(finishGoods.length === 30, 'Expected 30 finish goods');
  const revisionCount = await prisma.bomRevision.count();
  const revisionLineCount = await prisma.bomRevisionLine.count();
  const revisionEventCount = await prisma.bomRevisionEvent.count();
  const eventCounts = await prisma.bomRevisionEvent.groupBy({
    by: ['Action'],
    _count: { _all: true },
  });
  const eventCount = new Map(
    eventCounts.map((row) => [row.Action, row._count._all]),
  );
  const statusCounts = await prisma.bomRevision.groupBy({
    by: ['Status'],
    _count: { _all: true },
  });
  const statusCount = new Map(
    statusCounts.map((row) => [row.Status, row._count._all]),
  );
  const activeApprovedCount = await prisma.finishGood.count({
    where: {
      ActiveBomRevision: {
        is: { Revision: 2, Status: BomRevisionStatus.APPROVED },
      },
    },
  });
  const legacyBomCount = await prisma.billOfMaterials.count();
  const inconsistentProjection = await prisma.$queryRaw<
    Array<{ count: bigint }>
  >`
    SELECT COUNT(*)::bigint AS count
    FROM (
      (
        SELECT fg."Id", brl."MaterialId", brl."Qty"
        FROM "FinishGood" fg
        JOIN "BomRevisionLine" brl ON brl."RevisionId" = fg."ActiveBomRevisionId"
        EXCEPT
        SELECT "FinishGoodId", "MaterialId", "Qty" FROM "BillOfMaterials"
      )
      UNION ALL
      (
        SELECT "FinishGoodId", "MaterialId", "Qty" FROM "BillOfMaterials"
        EXCEPT
        SELECT fg."Id", brl."MaterialId", brl."Qty"
        FROM "FinishGood" fg
        JOIN "BomRevisionLine" brl ON brl."RevisionId" = fg."ActiveBomRevisionId"
      )
    ) projection_difference
  `;
  assert(revisionCount === 90, 'Expected 90 BOM revisions');
  assert(revisionLineCount === 450, 'Expected 450 BOM revision lines');
  assert(revisionEventCount === 230, 'Expected 230 BOM revision events');
  assert(
    eventCount.get('BASELINE_IMPORTED') === 30,
    'Expected 30 baseline events',
  );
  assert(eventCount.get('CREATED') === 60, 'Expected 60 created events');
  assert(eventCount.get('SUBMIT') === 70, 'Expected 70 submit events');
  assert(eventCount.get('APPROVE') === 60, 'Expected 60 approve events');
  assert(eventCount.get('CANCEL') === 10, 'Expected 10 cancel events');
  assert(
    statusCount.get(BomRevisionStatus.APPROVED) === 60,
    'Expected 60 approved revisions',
  );
  assert(
    statusCount.get(BomRevisionStatus.DRAFT) === 10,
    'Expected 10 draft revisions',
  );
  assert(
    statusCount.get(BomRevisionStatus.SUBMITTED) === 10,
    'Expected 10 submitted revisions',
  );
  assert(
    statusCount.get(BomRevisionStatus.CANCELLED) === 10,
    'Expected 10 cancelled revisions',
  );
  assert(
    activeApprovedCount === 30,
    'Expected 30 active approved BOM pointers',
  );
  assert(legacyBomCount === 150, 'Expected 150 legacy BOM projection rows');
  assert(
    inconsistentProjection[0]?.count === 0n,
    'Legacy BOM projection does not match active revision 2',
  );

  const materialStockCount = await prisma.material.count({
    where: {
      QtyRack: INITIAL_RACK_QTY,
      QtyWarehouse: INITIAL_WAREHOUSE_QTY,
    },
  });
  const rackLedgerCount = await prisma.inventoryLedger.count({
    where: {
      ItemCategory: ItemCategory.MATERIAL,
      Location: LocationType.RACK,
      BalanceBefore: 0,
      QtyIn: INITIAL_RACK_QTY,
      QtyOut: 0,
      BalanceAfter: INITIAL_RACK_QTY,
    },
  });
  const warehouseLedgerCount = await prisma.inventoryLedger.count({
    where: {
      ItemCategory: ItemCategory.MATERIAL,
      Location: LocationType.WAREHOUSE,
      BalanceBefore: 0,
      QtyIn: INITIAL_WAREHOUSE_QTY,
      QtyOut: 0,
      BalanceAfter: INITIAL_WAREHOUSE_QTY,
    },
  });
  assert(
    materialStockCount === materials.length,
    'Material stock cache mismatch',
  );
  assert(rackLedgerCount === materials.length, 'Rack ledger mismatch');
  assert(
    warehouseLedgerCount === materials.length,
    'Warehouse ledger mismatch',
  );

  console.log(
    JSON.stringify(
      {
        materials: 30,
        finishGoods: 30,
        bomRevisions: revisionCount,
        bomRevisionLines: revisionLineCount,
        bomRevisionEvents: revisionEventCount,
        bomRevisionEventActions: Object.fromEntries(eventCount),
        bomRevisionStatuses: Object.fromEntries(statusCount),
        activeApprovedBomPointers: activeApprovedCount,
        legacyBomProjectionRows: legacyBomCount,
        boxQty: 30,
        manpower: 16,
        forecasts: forecastIndex - 1,
        forecastCountByMonth,
        initialMaterialStock: {
          rackPerMaterial: INITIAL_RACK_QTY,
          warehousePerMaterial: INITIAL_WAREHOUSE_QTY,
          ledgerRows: materials.length * 2,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error('Dummy seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
