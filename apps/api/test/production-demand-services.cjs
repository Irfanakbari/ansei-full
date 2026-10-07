// Called only by production-demand-migration.cjs with a disposable database URL.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Workbook } = require('exceljs');
module.exports = async function verify(url) {
  assert.match(new URL(url).pathname, /^\/ansei_demand_\d+_test$/);
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = url;
  const { PrismaService } = require('../dist/src/prisma/prisma.service');
  const {
    LogProcessService,
  } = require('../dist/src/common/log-process/log-process.service');
  const { ExcelService } = require('../dist/src/common/utils/excel.service');
  const {
    ForecastNonPoService,
  } = require('../dist/src/production/forecast-non-po/forecast-non-po.service');
  const {
    ProductionReleaseService,
  } = require('../dist/src/production/production-release/production-release.service');
  const {
    ShoppingService,
  } = require('../dist/src/production/shopping/shopping.service');
  const {
    PokayokeService,
  } = require('../dist/src/production/pokayoke/pokayoke.service');
  const {
    DeliveryService,
  } = require('../dist/src/production/delivery/delivery.service');
  const {
    AssemblyService,
  } = require('../dist/src/production/assembly/assembly.service');
  const { OutboxService } = require('../dist/src/common/outbox/outbox.service');
  const { PrismaClient } = require('../dist/src/generated/prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  const actor = 'isolated-test';
  try {
    const log = new LogProcessService(prisma);
    const {
      ForecastService,
    } = require('../dist/src/production/forecast/forecast.service');
    const printPayloads = [];
    const forecastService = new ForecastService(
      prisma,
      log,
      new ExcelService(),
      {
        printPartTagAnsei: async (payload) => {
          printPayloads.push(payload);
          return { id: 'isolated-print' };
        },
      },
    );
    const nonpo = new ForecastNonPoService(
      prisma,
      log,
      new ExcelService(),
      forecastService,
    );
    const release = new ProductionReleaseService(prisma, log, {});
    const {
      OutboxStateService,
    } = require('../dist/src/common/outbox/outbox-state.service');
    const outbox = new OutboxService(
      prisma,
      new OutboxStateService(prisma, log),
      {},
    );
    const shopping = new ShoppingService(prisma, log, outbox);
    const pokayoke = new PokayokeService(prisma, log, shopping);
    const delivery = new DeliveryService(prisma, log, outbox);
    const assembly = new AssemblyService(prisma, log);
    const values = {
      partNumber: 'TEST-FG',
      deliveryDate: '2026-10-07',
      receivingArea: 'TEST',
      deliveryPeriod: 1,
      qty: 7,
      requestId: randomUUID(),
    };
    const saved = await nonpo.create(values, actor);
    assert.equal((await nonpo.create(values, actor)).Id, saved.Id);
    await assert.rejects(
      nonpo.create({ ...values, qty: 8 }, actor),
      /different data/,
    );
    await assert.rejects(
      nonpo.create({ ...values, requestId: randomUUID() }, actor),
      /identical/,
    );
    await nonpo.create(
      { ...values, requestId: randomUUID(), confirmDuplicates: true },
      actor,
    );
    const workbook = new Workbook();
    await workbook.xlsx.load(await nonpo.template());
    workbook.worksheets[0].addRow([
      'TEST-FG',
      '2026-10-08',
      'TEST',
      2,
      4,
      '',
      'Excel',
    ]);
    const file = {
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      originalname: 'test.xlsx',
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    assert.equal((await nonpo.preview(file)).rows[0].errors.length, 0);
    const imported = await nonpo.importFile(
      file,
      { requestId: randomUUID() },
      actor,
    );
    assert.equal(imported.created, 1);
    assert.equal(
      (await nonpo.importFile(file, { requestId: randomUUID() }, actor))
        .replayed,
      true,
    );
    workbook.worksheets[0].addRow(['TEST-FG', '2026-02-30', 'TEST', 0, -1]);
    const invalid = {
      ...file,
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    };
    const before = await prisma.forecastNonPo.count();
    await assert.rejects(
      nonpo.importFile(invalid, { requestId: randomUUID() }, actor),
      /spreadsheet errors/,
    );
    assert.equal(await prisma.forecastNonPo.count(), before);

    const material = await prisma.material.create({
      data: {
        PartNumber: 'TEST-MAT',
        PartName: 'Test material',
        CreatedBy: actor,
        UpdatedBy: actor,
        QtyRack: 100,
      },
    });
    await prisma.inventoryLedger.create({
      data: {
        ItemCategory: 'MATERIAL',
        MaterialId: material.PartNumber,
        Location: 'RACK',
        TransactionType: 'ADJUSTMENT_MANUAL',
        ReferenceDoc: 'TEST-OPENING',
        BalanceBefore: 0,
        QtyIn: 100,
        BalanceAfter: 100,
        CreatedBy: actor,
      },
    });
    const fg = await prisma.finishGood.findUniqueOrThrow({
      where: { PartNumber: 'TEST-FG' },
    });
    const bom = await prisma.bomRevision.create({
      data: {
        FinishGoodId: fg.Id,
        Revision: 1,
        Status: 'DRAFT',
        Reason: 'Test fixture',
        CreatedBy: actor,
        LastEditedBy: actor,
        ApprovedBy: 'test-checker',
        ApprovedAt: new Date(),
        Lines: {
          create: [
            {
              MaterialId: material.Id,
              PartNumber: material.PartNumber,
              PartName: material.PartName,
              Qty: 1,
            },
          ],
        },
      },
    });
    await prisma.bomRevision.update({
      where: { Id: bom.Id },
      data: { Status: 'APPROVED' },
    });
    await prisma.finishGood.update({
      where: { Id: fg.Id },
      data: { ActiveBomRevisionId: bom.Id, IsPassthrough: true },
    });
    await prisma.boxQTY.create({
      data: {
        PartNumber: fg.PartNumber,
        Qty: 4,
        CreatedBy: actor,
        UpdatedBy: actor,
      },
    });
    await prisma.manPower.create({
      data: {
        Nik: 'TEST-OP',
        Name: 'Test Operator',
        CreatedBy: actor,
        UpdatedBy: actor,
        EmployeeType: 'TEST',
      },
    });
    for (const journey of ['NON_PO', 'PO', 'NON_PO_ASSEMBLY', 'PO_ASSEMBLY']) {
      const requiresAssembly = journey.endsWith('_ASSEMBLY');
      const source = journey.startsWith('NON_PO') ? 'NON_PO' : 'PO';
      await prisma.finishGood.update({
        where: { Id: fg.Id },
        data: { IsPassthrough: !requiresAssembly },
      });
      let orderId = source === 'NON_PO' ? saved.ReferenceNumber : 'OLD-PO';
      if (requiresAssembly) {
        if (source === 'NON_PO')
          orderId = (
            await nonpo.create(
              {
                ...values,
                requestId: randomUUID(),
                notes: journey,
                confirmDuplicates: true,
              },
              actor,
            )
          ).ReferenceNumber;
        else {
          const original = await prisma.forecast.findUniqueOrThrow({
            where: { PoId: 'OLD-PO' },
          });
          const { Id, ProductionReleaseId, ...fields } = original;
          orderId = 'PO-ASSEMBLY';
          await prisma.forecast.create({ data: { ...fields, PoId: orderId } });
        }
      }
      if (source === 'PO')
        await prisma.productionDemand.update({
          where: { Id: orderId },
          data: { ProductionReleaseId: null },
        });
      // The old barcode fixture is only for migration assertions, not an active label.
      if (source === 'PO')
        await prisma.labelData.deleteMany({
          where: { ProductionDemandId: orderId },
        });
      const created = await release.create(
        {
          planDate: new Date(),
          sourceType: source,
          demandIds: [orderId],
          isNoAttachment: true,
        },
        actor,
      );
      await release.update(created.Id, { status: 'RELEASED' }, actor);
      const labels = await prisma.labelData.findMany({
        where: { ProductionDemandId: orderId },
        orderBy: { LabelNumber: 'asc' },
      });
      assert.deepEqual(
        labels.map((l) => l.QtyThisBox),
        [4, 3],
      );
      if (journey === 'NON_PO') {
        await nonpo.print(saved.Id, actor);
        assert.equal(printPayloads[0].poId, saved.ReferenceNumber);
        assert.equal(printPayloads[0].poNumber, '');
        assert.equal(printPayloads[0].vendorCode, '');
        const artifacts = path.resolve('../../.codex-build/demand');
        fs.mkdirSync(artifacts, { recursive: true });
        fs.writeFileSync(
          path.join(artifacts, 'non-po-api.pdf'),
          await nonpo.download(saved.Id),
        );
        fs.writeFileSync(
          path.join(artifacts, 'non-po-printer-payload.json'),
          JSON.stringify(printPayloads[0]),
        );
      }
      assert.equal(
        (await release.findOne(created.Id)).Forecasts[0].SourceType,
        source,
      );
      await assert.rejects(
        release.update(
          created.Id,
          { status: 'COMPLETED', totalProductionMinutes: 1 },
          actor,
        ),
      );
      const snapshot = await prisma.productionBomSnapshot.findFirstOrThrow({
        where: { ProductionDemandId: orderId, ReleaseId: created.Id },
      });
      const pick = {
        purpose: 'STANDARD',
        type: 'REGULER',
        forecastId: orderId,
        snapshotId: snapshot.Id,
        materialId: material.PartNumber,
        qtyPick: 7,
        requestId: randomUUID(),
      };
      await shopping.create(pick, actor);
      await shopping.create(pick, actor);
      assert.equal(
        await prisma.shopping.count({ where: { ProductionDemandId: orderId } }),
        1,
      );
      const printEvents = await prisma.outboxEvent.findMany({
        where: { IdempotencyKey: `print-part-tag:${orderId}` },
      });
      assert.equal(
        printEvents.length,
        1,
        'Picking retry must not duplicate automatic print',
      );
      const printPayload = printEvents[0].Payload;
      assert.equal(printEvents[0].Type, 'PRINT_PART_TAG_ANSEI');
      assert.equal(printPayload.poId, orderId);
      assert.equal(printPayload.qtyOrder, 7);
      assert.equal(printPayload.qtyPerbox, 4);
      assert.deepEqual(
        labels.map((label, index) => label.LabelNumber),
        [4, 3].map(
          (qty, index) =>
            `${printPayload.poId}${String(index + 1).padStart(3, '0')}${String(qty).padStart(5, '0')}`,
        ),
      );
      if (source === 'NON_PO') {
        assert.equal(printPayload.poNumber, '');
        assert.equal(printPayload.vendorCode, '');
        assert.equal(printPayload.classificationCode, '');
      }

      if (source === 'NON_PO' && !requiresAssembly) {
        await assert.rejects(
          nonpo.update(saved.Id, { qty: 8 }, actor),
          /Operational activity/,
        );
        await nonpo.update(
          saved.Id,
          { poNumber: 'LATE-PO', notes: 'No progress reset' },
          actor,
        );
        assert.deepEqual(
          (
            await prisma.labelData.findMany({
              where: { ProductionDemandId: orderId },
              orderBy: { LabelNumber: 'asc' },
            })
          ).map((l) => l.LabelNumber),
          labels.map((l) => l.LabelNumber),
        );
      }
      for (const label of labels) {
        if (requiresAssembly) {
          const session = await assembly.start(
            {
              labelNumber: label.LabelNumber,
              requestId: randomUUID(),
              manPowerNik: 'TEST-OP',
            },
            actor,
            'INTERNAL',
          );
          const completed = { requestId: randomUUID(), manPowerNik: 'TEST-OP' };
          await assembly.complete(session.Id, completed, actor);
          await assembly.complete(session.Id, completed, actor);
        }
        await pokayoke.scan(
          { labelNumber: label.LabelNumber, status: 'SUKSES' },
          actor,
        );
        await delivery.create({ labelNumber: label.LabelNumber }, actor);
      }
      await release.update(
        created.Id,
        { status: 'COMPLETED', totalProductionMinutes: 1 },
        actor,
      );
      assert.equal(
        (await prisma.finishGood.findUnique({ where: { Id: fg.Id } })).Qty,
        0,
      );
    }
    const raceOrders = [];
    for (const n of [1, 2])
      raceOrders.push(
        await nonpo.create(
          { ...values, requestId: randomUUID(), notes: `Race ${n}` },
          actor,
        ),
      );
    const raceReleases = [];
    for (const order of raceOrders)
      raceReleases.push(
        await release.create(
          {
            sourceType: 'NON_PO',
            demandIds: [order.ReferenceNumber],
            planDate: new Date(),
            isNoAttachment: true,
          },
          actor,
        ),
      );
    const raced = await Promise.allSettled(
      raceReleases.map((r) =>
        release.update(r.Id, { status: 'RELEASED' }, actor),
      ),
    );
    assert.equal(raced.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(
      await prisma.productionRelease.count({ where: { Status: 'RELEASED' } }),
      1,
    );
    await assert.rejects(
      release.create(
        {
          sourceType: 'PO',
          demandIds: [raceOrders[0].ReferenceNumber],
          planDate: new Date(),
        },
        actor,
      ),
    );
    await assert.rejects(
      release.create(
        {
          demandIds: ['OLD-PO'],
          forecastIds: ['OLD-PO'],
          planDate: new Date(),
        },
        actor,
      ),
      /not both/,
    );
    const candidates = await release.getCandidateIds({
      sourceType: 'NON_PO',
      page: 1,
      limit: 1,
    });
    assert.equal(candidates.forecastIds.length, 0);
    assert.equal(candidates.total, candidates.demandIds.length);
    assert(candidates.demandIds.every((id) => id.startsWith('NPO-')));
    console.log(
      'PASS: concurrent activation leaves exactly one active release; mixed sources and ambiguous ID requests rejected.',
    );
    const entries = await prisma.inventoryLedger.findMany();
    assert(
      entries.every(
        (e) => e.BalanceAfter === e.BalanceBefore + e.QtyIn - e.QtyOut,
      ),
    );
    console.log(
      'PASS: real Prisma view relations, manual replay/duplicates, Excel validation/atomic import/replay, PO and Non PO partial-box shopping/assembly/passthrough/Poka-Yoke/delivery/close, operational lock and late PO without label reset, ledger invariant.',
    );
  } finally {
    await prisma.$disconnect();
    process.env.DATABASE_URL = previous;
  }
};
