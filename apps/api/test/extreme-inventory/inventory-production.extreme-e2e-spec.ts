/* By Irfan Akbari Vuteq Indonesia - 2026-09-24 */
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request, { Response } from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  assertInventoryIntegrity,
  createExtremeTestApp,
  responseData,
  truncateApplicationTables,
} from './extreme-test-harness';

type Entity = Record<string, unknown>;

const API = '/v1';
const RACE_WAVES = 5;
const FAN_OUT = 16;
const auth = (token = 'extreme-admin') => `Bearer ${token}`;
const ok = (responses: Response[], status: number) =>
  responses.filter((response) => response.status === status);
const expectOnlyStatuses = (responses: Response[], allowed: number[]) => {
  const unexpected = responses
    .filter((response) => !allowed.includes(response.status))
    .map((response) => ({ status: response.status, body: response.body }));
  expect(unexpected).toEqual([]);
};

describe('Extreme inventory and production E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const post = (
    path: string,
    body: object,
    token = 'extreme-admin',
    idempotencyKey?: string,
  ) => {
    const call = request(app.getHttpServer())
      .post(`${API}${path}`)
      .set('Authorization', auth(token))
      .send(body);
    return idempotencyKey ? call.set('Idempotency-Key', idempotencyKey) : call;
  };
  const patch = (path: string, body: object, token = 'extreme-admin') =>
    request(app.getHttpServer())
      .patch(`${API}${path}`)
      .set('Authorization', auth(token))
      .send(body);
  const race = async (operation: () => Promise<Response>) => {
    const results: Response[] = [];
    for (let wave = 0; wave < RACE_WAVES; wave += 1) {
      results.push(
        ...(await Promise.all(
          Array.from({ length: FAN_OUT }, () => operation()),
        )),
      );
    }
    return results;
  };

  beforeAll(async () => {
    ({ app, prisma } = await createExtremeTestApp());
    await truncateApplicationTables(prisma);
  });

  afterEach(async () => {
    if (!prisma) return;
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS extreme_fail_shopping ON "Shopping"',
    );
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS extreme_fail_assembly ON "AssemblySession"',
    );
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS extreme_fail_delivery ON "FinishGood"',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS extreme_fail_shopping()',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS extreme_fail_assembly()',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS extreme_fail_delivery()',
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('keeps authentication and permission boundaries active', async () => {
    await request(app.getHttpServer())
      .get(`${API}/master/material`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`${API}/master/material`)
      .set('Authorization', auth('extreme-denied'))
      .expect(403);
  });

  it('survives the complete production journey, races, retries and rollbacks', async () => {
    const supplier = responseData<Entity>(
      (await post('/master/supplier', { name: 'Extreme Supplier' }).expect(201))
        .body,
    );
    const unit = responseData<Entity>(
      (await post('/master/satuan', { name: 'EXT-PCS' }).expect(201)).body,
    );

    const materials = [] as Entity[];
    for (const [partNumber, partName] of [
      ['EXT-MAT-SHARED', 'Extreme shared material'],
      ['EXT-MAT-ASSY', 'Extreme assembly material'],
      ['EXT-MAT-PASS', 'Extreme passthrough material'],
      ['EXT-MAT-RACE', 'Extreme race-only material'],
    ]) {
      const result = await post('/master/material', {
        partNumber,
        partName,
        supplierId: supplier.Id,
        satuanId: unit.Id,
        rackLocation: 'EXT-RACK',
      }).expect(201);
      materials.push(responseData<Entity>(result.body));
    }

    const assemblyFg = responseData<Entity>(
      (
        await post('/master/finish-good', {
          partNumber: 'EXT-FG-ASSY',
          partName: 'Extreme assembly FG',
          isPassthrough: false,
        }).expect(201)
      ).body,
    );
    const passthroughFg = responseData<Entity>(
      (
        await post('/master/finish-good', {
          partNumber: 'EXT-FG-PASS',
          partName: 'Extreme passthrough FG',
          isPassthrough: true,
        }).expect(201)
      ).body,
    );
    await post('/master/finish-good/box-qty', {
      partNumber: 'EXT-FG-ASSY',
      qty: 5,
    }).expect(201);
    await post('/master/finish-good/box-qty', {
      partNumber: 'EXT-FG-PASS',
      qty: 4,
    }).expect(201);
    for (const [nik, name] of [
      ['EXT-OP-1', 'Extreme Operator 1'],
      ['EXT-OP-2', 'Extreme Operator 2'],
      ['EXT-OP-3', 'Extreme Operator 3'],
    ]) {
      await post('/master/man-power', {
        nik,
        name,
        line: 'EXT-LINE',
        status: true,
      }).expect(201);
    }

    const createApprovedBom = async (
      finishGoodId: number,
      lines: Array<{ materialId: number; qty: number }>,
    ) => {
      const created = responseData<Entity>(
        (
          await post(
            '/master/bom-revisions',
            { finishGoodId, reason: 'Extreme baseline', lines },
            'extreme-maker',
            randomUUID(),
          ).expect(201)
        ).body,
      );
      const submitted = responseData<Entity>(
        (
          await post(
            `/master/bom-revisions/${String(created.Id)}/submit`,
            { expectedVersion: created.Version },
            'extreme-maker',
            randomUUID(),
          ).expect(201)
        ).body,
      );
      await post(
        `/master/bom-revisions/${String(created.Id)}/approve`,
        { expectedVersion: submitted.Version },
        'extreme-maker',
        randomUUID(),
      ).expect(403);
      return responseData<Entity>(
        (
          await post(
            `/master/bom-revisions/${String(created.Id)}/approve`,
            { expectedVersion: submitted.Version },
            'extreme-checker',
            randomUUID(),
          ).expect(201)
        ).body,
      );
    };
    await createApprovedBom(Number(assemblyFg.Id), [
      { materialId: Number(materials[0].Id), qty: 2 },
      { materialId: Number(materials[1].Id), qty: 1 },
    ]);
    await createApprovedBom(Number(passthroughFg.Id), [
      { materialId: Number(materials[0].Id), qty: 1 },
      { materialId: Number(materials[2].Id), qty: 3 },
    ]);

    const incoming = responseData<Entity>(
      (
        await post('/warehouse/incoming', {
          poId: 'EXT-INCOMING-001',
          description: 'Extreme inventory fixture',
          receivedBy: 'Extreme Receiver',
          supplierId: supplier.Id,
          materials: materials.map((material, index) => ({
            materialId: material.Id,
            qty: index === 3 ? 10 : 100,
          })),
        }).expect(201)
      ).body,
    );
    const incomingRows = await prisma.incomingMaterial.findMany({
      where: { IncomingId: String(incoming.Id) },
      orderBy: { Id: 'asc' },
    });
    await post(`/warehouse/incoming/${String(incoming.Id)}/check`, {
      materials: incomingRows.map((row) => ({
        incomingMaterialId: row.Id,
        qtyChecked: row.Qty,
      })),
    }).expect(201);
    const receiveKey = randomUUID();
    const receives = await race(() =>
      post(
        `/warehouse/incoming/${String(incoming.Id)}/receive`,
        {},
        'extreme-admin',
        receiveKey,
      ),
    );
    expectOnlyStatuses(receives, [201, 409]);
    expect(ok(receives, 201).length).toBeGreaterThan(0);
    await post(
      `/warehouse/incoming/${String(incoming.Id)}/receive`,
      {},
      'extreme-admin',
      receiveKey,
    ).expect(201);
    expect(
      await prisma.inventoryLedger.count({
        where: { ReferenceDoc: 'EXT-INCOMING-001' },
      }),
    ).toBe(4);

    for (const material of materials.slice(0, 3)) {
      const key = randomUUID();
      await post(
        `/warehouse/material/${String(material.PartNumber)}/transfer-to-rack`,
        { qty: 100, requestId: key },
        'extreme-admin',
        key,
      ).expect(201);
    }
    const transferRace = await race(() => {
      const key = randomUUID();
      return post(
        '/warehouse/material/EXT-MAT-RACE/transfer-to-rack',
        { qty: 7, requestId: key },
        'extreme-admin',
        key,
      );
    });
    expect(ok(transferRace, 201)).toHaveLength(1);
    expect(transferRace.filter((entry) => entry.status >= 400)).toHaveLength(
      RACE_WAVES * FAN_OUT - 1,
    );
    await assertInventoryIntegrity(prisma);

    const forecastPayloads = [
      {
        poId: 'EXT-PO-ASSY',
        qty: 12,
        finishGoodId: 'EXT-FG-ASSY',
      },
      {
        poId: 'EXT-PO-PASS',
        qty: 7,
        finishGoodId: 'EXT-FG-PASS',
      },
    ].map((forecast, index) => ({
      ...forecast,
      date: '2026-09-24T00:00:00.000Z',
      vendorCode: 'EXT-VENDOR',
      vendorName: 'Extreme Customer',
      receivingArea: 'EXT-DOCK',
      deliveryDate: '2026-09-25T00:00:00.000Z',
      deliveryPeriod: 1,
      classification: 'REGULER',
      poNumber: `EXT-CUSTOMER-PO-${index + 1}`,
      item: index + 1,
    }));
    for (const forecast of forecastPayloads) {
      const forecastResponse = await post('/production/forecast', forecast);
      if (forecastResponse.status !== 201) {
        throw new Error(
          `Forecast fixture rejected with ${forecastResponse.status}: ${JSON.stringify(forecastResponse.body)}`,
        );
      }
    }
    await post('/production/forecast', {
      ...forecastPayloads[0],
      poId: 'EXT-PO-RELEASE-RACE',
      poNumber: 'EXT-CUSTOMER-PO-RACE',
      qty: 1,
    }).expect(201);
    let releaseCandidate = 0;
    const releaseAssignmentRace = await race(() => {
      releaseCandidate += 1;
      return post('/production/production-release', {
        releaseNumber: `EXT-RELEASE-RACE-${releaseCandidate}`,
        planDate: '2026-09-24T00:00:00.000Z',
        forecastIds: ['EXT-PO-RELEASE-RACE'],
        isNoAttachment: true,
      });
    });
    expect(ok(releaseAssignmentRace, 201)).toHaveLength(1);
    expect(
      releaseAssignmentRace.filter((entry) => entry.status >= 400),
    ).toHaveLength(RACE_WAVES * FAN_OUT - 1);
    const release = responseData<Entity>(
      (
        await post('/production/production-release', {
          releaseNumber: 'EXT-RELEASE-001',
          planDate: '2026-09-24T00:00:00.000Z',
          notes: 'Extreme production release',
          forecastIds: ['EXT-PO-ASSY', 'EXT-PO-PASS'],
          isNoAttachment: true,
        }).expect(201)
      ).body,
    );
    await patch(`/production/production-release/${String(release.Id)}`, {
      status: 'RELEASED',
    }).expect(200);
    const snapshots = await prisma.productionBomSnapshot.findMany({
      where: { ReleaseId: String(release.Id) },
      include: { Lines: true },
    });
    expect(snapshots).toHaveLength(2);
    expect(await prisma.labelData.count()).toBe(5);
    const prematurePassthroughLabel = await prisma.labelData.findFirstOrThrow({
      where: { ForecastId: 'EXT-PO-PASS' },
    });
    await post('/production/pokayoke/scan', {
      labelNumber: prematurePassthroughLabel.LabelNumber,
      status: 'SUKSES',
    }).expect(400);

    const assemblySnapshot = snapshots.find(
      (snapshot) => snapshot.ForecastId === 'EXT-PO-ASSY',
    )!;
    const capturedAssemblyRequirements = assemblySnapshot.Lines.map((line) => ({
      partNumber: line.PartNumber,
      requiredQty: line.RequiredQty,
    })).sort((left, right) => left.partNumber.localeCompare(right.partNumber));
    await createApprovedBom(Number(assemblyFg.Id), [
      { materialId: Number(materials[0].Id), qty: 9 },
      { materialId: Number(materials[1].Id), qty: 1 },
    ]);
    const persistedAssemblySnapshot =
      await prisma.productionBomSnapshot.findUniqueOrThrow({
        where: { Id: assemblySnapshot.Id },
        include: { Lines: true },
      });
    expect(
      persistedAssemblySnapshot.Lines.map((line) => ({
        partNumber: line.PartNumber,
        requiredQty: line.RequiredQty,
      })).sort((left, right) =>
        left.partNumber.localeCompare(right.partNumber),
      ),
    ).toEqual(capturedAssemblyRequirements);
    const sharedLine = assemblySnapshot.Lines.find(
      (line) => line.PartNumber === 'EXT-MAT-SHARED',
    )!;
    const failedRequest = randomUUID();
    const rackBeforeFailure = (
      await prisma.material.findUniqueOrThrow({
        where: { PartNumber: 'EXT-MAT-SHARED' },
      })
    ).QtyRack;
    const ledgerBeforeFailure = await prisma.inventoryLedger.count();
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION extreme_fail_shopping() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."Description" = 'EXTREME_FAIL_SHOPPING' THEN
          RAISE EXCEPTION 'extreme shopping rollback';
        END IF;
        RETURN NEW;
      END $$
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER extreme_fail_shopping BEFORE INSERT ON "Shopping"
      FOR EACH ROW EXECUTE FUNCTION extreme_fail_shopping()
    `);
    const failedShopping = await post(
      '/production/shopping',
      {
        requestId: failedRequest,
        purpose: 'STANDARD',
        snapshotId: assemblySnapshot.Id,
        forecastId: 'EXT-PO-ASSY',
        materialId: sharedLine.PartNumber,
        qtyPick: sharedLine.RequiredQty,
        type: 'REGULER',
        description: 'EXTREME_FAIL_SHOPPING',
      },
      'extreme-admin',
      failedRequest,
    );
    expect(failedShopping.status).toBeGreaterThanOrEqual(500);
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER extreme_fail_shopping ON "Shopping"',
    );
    await prisma.$executeRawUnsafe('DROP FUNCTION extreme_fail_shopping()');
    expect(
      (
        await prisma.material.findUniqueOrThrow({
          where: { PartNumber: 'EXT-MAT-SHARED' },
        })
      ).QtyRack,
    ).toBe(rackBeforeFailure);
    expect(await prisma.inventoryLedger.count()).toBe(ledgerBeforeFailure);
    expect(
      await prisma.businessCommand.count({
        where: { RequestId: failedRequest },
      }),
    ).toBe(0);

    const opname = await prisma.stockOpname.create({
      data: {
        OpnameNumber: 'EXT-OPNAME-BLOCK',
        Category: 'MATERIAL',
        Status: 'IN_PROGRESS',
        CreatedBy: 'extreme-admin',
      },
    });
    const blockedKey = randomUUID();
    const blockedShopping = await post(
      '/production/shopping',
      {
        requestId: blockedKey,
        purpose: 'STANDARD',
        snapshotId: assemblySnapshot.Id,
        forecastId: 'EXT-PO-ASSY',
        materialId: sharedLine.PartNumber,
        qtyPick: 1,
        type: 'REGULER',
      },
      'extreme-admin',
      blockedKey,
    );
    expect(blockedShopping.status).toBeGreaterThanOrEqual(400);
    await prisma.stockOpname.update({
      where: { Id: opname.Id },
      data: { Status: 'CANCELLED' },
    });

    const shoppingBeforeGuards = await prisma.shopping.count();
    const ledgerBeforeGuards = await prisma.inventoryLedger.count();
    const overPickKey = randomUUID();
    await post(
      '/production/shopping',
      {
        requestId: overPickKey,
        purpose: 'STANDARD',
        snapshotId: assemblySnapshot.Id,
        forecastId: 'EXT-PO-ASSY',
        materialId: sharedLine.PartNumber,
        qtyPick: sharedLine.RequiredQty + 1,
        type: 'REGULER',
      },
      'extreme-admin',
      overPickKey,
    ).expect(400);
    expect(await prisma.shopping.count()).toBe(shoppingBeforeGuards);
    expect(await prisma.inventoryLedger.count()).toBe(ledgerBeforeGuards);

    const sharedMaterialBeforeMismatch =
      await prisma.material.findUniqueOrThrow({
        where: { PartNumber: sharedLine.PartNumber },
      });
    await prisma.material.update({
      where: { PartNumber: sharedLine.PartNumber },
      data: { QtyRack: sharedMaterialBeforeMismatch.QtyRack + 1 },
    });
    const mismatchKey = randomUUID();
    await post(
      '/production/shopping',
      {
        requestId: mismatchKey,
        purpose: 'STANDARD',
        snapshotId: assemblySnapshot.Id,
        forecastId: 'EXT-PO-ASSY',
        materialId: sharedLine.PartNumber,
        qtyPick: sharedLine.RequiredQty,
        type: 'REGULER',
      },
      'extreme-admin',
      mismatchKey,
    ).expect(400);
    await prisma.material.update({
      where: { PartNumber: sharedLine.PartNumber },
      data: { QtyRack: sharedMaterialBeforeMismatch.QtyRack },
    });
    expect(await prisma.shopping.count()).toBe(shoppingBeforeGuards);
    expect(await prisma.inventoryLedger.count()).toBe(ledgerBeforeGuards);

    let sharedShoppingBody: Record<string, unknown> | undefined;
    for (const snapshot of snapshots) {
      for (const line of snapshot.Lines) {
        const body = {
          requestId: randomUUID(),
          purpose: 'STANDARD',
          snapshotId: snapshot.Id,
          forecastId: snapshot.ForecastId,
          materialId: line.PartNumber,
          qtyPick: line.RequiredQty,
          type: 'REGULER',
          description: `Extreme pick ${snapshot.ForecastId}`,
        };
        if (
          snapshot.ForecastId === 'EXT-PO-ASSY' &&
          line.PartNumber === 'EXT-MAT-SHARED'
        ) {
          sharedShoppingBody = body;
          const duplicated = await race(() =>
            post('/production/shopping', body, 'extreme-admin', body.requestId),
          );
          expectOnlyStatuses(duplicated, [201, 409]);
          expect(ok(duplicated, 201).length).toBeGreaterThan(0);
          await post(
            '/production/shopping',
            body,
            'extreme-admin',
            body.requestId,
          ).expect(201);
          expect(
            await prisma.shopping.count({
              where: {
                ForecastId: snapshot.ForecastId,
                MaterialId: line.PartNumber,
                Purpose: 'STANDARD',
              },
            }),
          ).toBe(1);
        } else {
          await post(
            '/production/shopping',
            body,
            'extreme-admin',
            body.requestId,
          ).expect(201);
        }
      }
    }
    expect(await prisma.shoppingCompletion.count()).toBe(2);
    expect(
      await prisma.inventoryLedger.count({
        where: {
          TransactionType: 'PRODUCTION_RESULT',
          FinishGoodId: 'EXT-FG-PASS',
        },
      }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: { Type: 'PRINT_PART_TAG_ANSEI' },
      }),
    ).toBe(2);
    expect(sharedShoppingBody).toBeDefined();
    await post(
      '/production/shopping',
      sharedShoppingBody!,
      'extreme-maker',
      String(sharedShoppingBody!.requestId),
    ).expect(409);

    const invalidLine = snapshots[0].Lines[0];
    for (const qtyPick of [0, -1, 1.5, 2_147_483_648]) {
      const invalidKey = randomUUID();
      await post(
        '/production/shopping',
        {
          requestId: invalidKey,
          purpose: 'STANDARD',
          snapshotId: snapshots[0].Id,
          forecastId: snapshots[0].ForecastId,
          materialId: invalidLine.PartNumber,
          qtyPick,
          type: 'REGULER',
        },
        'extreme-admin',
        invalidKey,
      ).expect(400);
    }
    const firstShoppingCommand = await prisma.businessCommand.findFirstOrThrow({
      where: { Scope: 'SHOPPING' },
      include: { Shopping: true },
    });
    await post(
      '/production/shopping',
      {
        requestId: firstShoppingCommand.RequestId,
        purpose: 'STANDARD',
        snapshotId: assemblySnapshot.Id,
        forecastId: 'EXT-PO-ASSY',
        materialId: 'EXT-MAT-SHARED',
        qtyPick: 1,
        type: 'REGULER',
      },
      'extreme-admin',
      firstShoppingCommand.RequestId,
    ).expect(409);

    const ngCreateKey = randomUUID();
    const ngCaseResponse = await post(
      '/production/material-ng-cases',
      {
        requestId: ngCreateKey,
        forecastId: 'EXT-PO-ASSY',
        snapshotId: assemblySnapshot.Id,
        stage: 'SHOPPING',
        reason: 'Extreme replacement race',
        lines: [
          {
            materialId: 'EXT-MAT-SHARED',
            qtyNg: 1,
            qtyReplacement: 1,
          },
        ],
      },
      'extreme-admin',
      ngCreateKey,
    ).expect(201);
    const ngCase = responseData<Entity>(ngCaseResponse.body);
    const ngRow = await prisma.materialNG.findFirstOrThrow({
      where: { CaseId: String(ngCase.Id) },
    });
    const ngIssueKey = randomUUID();
    const ngIssues = await race(() =>
      post(
        `/production/material-ng-cases/${String(ngCase.Id)}/issue`,
        {
          requestId: ngIssueKey,
          lines: [{ detailId: ngRow.Id, qty: 1 }],
        },
        'extreme-admin',
        ngIssueKey,
      ),
    );
    expectOnlyStatuses(ngIssues, [201, 409]);
    expect(ok(ngIssues, 201).length).toBeGreaterThan(0);
    await post(
      `/production/material-ng-cases/${String(ngCase.Id)}/issue`,
      {
        requestId: ngIssueKey,
        lines: [{ detailId: ngRow.Id, qty: 1 }],
      },
      'extreme-admin',
      ngIssueKey,
    ).expect(201);
    expect(
      await prisma.shopping.count({
        where: { MaterialNgId: ngRow.Id, Purpose: 'NG_REPLACEMENT' },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.materialNgCase.findUniqueOrThrow({
          where: { Id: String(ngCase.Id) },
        })
      ).Status,
    ).toBe('FULFILLED');
    await assertInventoryIntegrity(prisma);

    const assemblyLabels = await prisma.labelData.findMany({
      where: { ForecastId: 'EXT-PO-ASSY' },
      orderBy: { Id: 'asc' },
    });
    const passLabels = await prisma.labelData.findMany({
      where: { ForecastId: 'EXT-PO-PASS' },
      orderBy: { Id: 'asc' },
    });
    expect(assemblyLabels.map((label) => label.QtyThisBox)).toEqual([5, 5, 2]);
    expect(passLabels.map((label) => label.QtyThisBox)).toEqual([4, 3]);

    let startIndex = 0;
    const starts = await race(() => {
      const index = startIndex;
      startIndex += 1;
      return post('/production/assembly/start', {
        labelNumber: assemblyLabels[0].LabelNumber,
        manPowerNik: index % 2 === 0 ? 'EXT-OP-1' : 'EXT-OP-2',
        requestId: randomUUID(),
      });
    });
    expect(ok(starts, 201)).toHaveLength(1);
    const firstSession = responseData<Entity>(ok(starts, 201)[0].body);
    await post('/production/pokayoke/scan', {
      labelNumber: assemblyLabels[0].LabelNumber,
      status: 'SUKSES',
    }).expect(400);
    await patch(`/production/production-release/${String(release.Id)}`, {
      status: 'COMPLETED',
      totalProductionMinutes: 1,
    }).expect(400);

    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION extreme_fail_assembly() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."Status" = 'COMPLETED' AND OLD."Status" = 'IN_PROGRESS' THEN
          RAISE EXCEPTION 'extreme assembly rollback';
        END IF;
        RETURN NEW;
      END $$
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER extreme_fail_assembly BEFORE UPDATE ON "AssemblySession"
      FOR EACH ROW EXECUTE FUNCTION extreme_fail_assembly()
    `);
    const failedComplete = await post(
      `/production/assembly/${String(firstSession.Id)}/complete`,
      { requestId: randomUUID() },
    );
    expect(failedComplete.status).toBeGreaterThanOrEqual(500);
    expect(
      (
        await prisma.assemblySession.findUniqueOrThrow({
          where: { Id: String(firstSession.Id) },
        })
      ).Status,
    ).toBe('IN_PROGRESS');
    expect(
      await prisma.inventoryLedger.count({
        where: { ReferenceDoc: `ASSY-${String(firstSession.Id)}` },
      }),
    ).toBe(0);
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER extreme_fail_assembly ON "AssemblySession"',
    );
    await prisma.$executeRawUnsafe('DROP FUNCTION extreme_fail_assembly()');
    const completes = await race(() =>
      post(`/production/assembly/${String(firstSession.Id)}/complete`, {
        requestId: randomUUID(),
      }),
    );
    expectOnlyStatuses(completes, [200, 409]);
    expect(ok(completes, 200).length).toBeGreaterThan(0);
    await post(`/production/assembly/${String(firstSession.Id)}/complete`, {
      requestId: randomUUID(),
    }).expect(200);
    expect(
      await prisma.inventoryLedger.count({
        where: { ReferenceDoc: `ASSY-${String(firstSession.Id)}` },
      }),
    ).toBe(1);

    await post('/production/pokayoke/scan', {
      labelNumber: assemblyLabels[0].LabelNumber,
      status: 'GAGAL',
    }).expect(201);
    expect(
      (
        await prisma.labelData.findUniqueOrThrow({
          where: { Id: assemblyLabels[0].Id },
        })
      ).Scanned,
    ).toBe(false);
    await post('/production/delivery', {
      labelDataId: assemblyLabels[0].Id,
      palletNumber: 'EXT-PALLET-BLOCKED',
    }).expect(400);
    const scanRace = await race(() =>
      post('/production/pokayoke/scan', {
        labelNumber: assemblyLabels[0].LabelNumber,
        status: 'SUKSES',
      }),
    );
    expect(ok(scanRace, 201)).toHaveLength(1);
    expect(
      await prisma.pokayokeScanHistory.count({
        where: {
          LabelNumber: assemblyLabels[0].LabelNumber,
          Status: 'SUKSES',
        },
      }),
    ).toBe(1);

    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION extreme_fail_delivery() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD."PartNumber" = 'EXT-FG-ASSY' AND NEW."Qty" < OLD."Qty" THEN
          RAISE EXCEPTION 'extreme delivery rollback';
        END IF;
        RETURN NEW;
      END $$
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER extreme_fail_delivery BEFORE UPDATE ON "FinishGood"
      FOR EACH ROW EXECUTE FUNCTION extreme_fail_delivery()
    `);
    const fgBeforeDelivery = (
      await prisma.finishGood.findUniqueOrThrow({
        where: { PartNumber: 'EXT-FG-ASSY' },
      })
    ).Qty;
    const failedDelivery = await post('/production/delivery', {
      labelDataId: assemblyLabels[0].Id,
      palletNumber: 'EXT-PALLET-FAIL',
    });
    expect(failedDelivery.status).toBeGreaterThanOrEqual(500);
    expect(await prisma.deliveryHistory.count()).toBe(0);
    expect(
      (
        await prisma.finishGood.findUniqueOrThrow({
          where: { PartNumber: 'EXT-FG-ASSY' },
        })
      ).Qty,
    ).toBe(fgBeforeDelivery);
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER extreme_fail_delivery ON "FinishGood"',
    );
    await prisma.$executeRawUnsafe('DROP FUNCTION extreme_fail_delivery()');
    const deliveryRace = await race(() =>
      post('/production/delivery', {
        labelDataId: assemblyLabels[0].Id,
        palletNumber: 'EXT-PALLET-1',
      }),
    );
    expect(deliveryRace.some((entry) => entry.status === 201)).toBe(true);
    expect(deliveryRace.every((entry) => entry.status < 500)).toBe(true);
    expect(
      await prisma.deliveryHistory.count({
        where: { LabelDataId: assemblyLabels[0].LabelNumber },
      }),
    ).toBe(1);

    const remainingAssemblyLabels = assemblyLabels.slice(1);
    const manpowerRace = await Promise.all(
      remainingAssemblyLabels.map((label) =>
        post('/production/assembly/start', {
          labelNumber: label.LabelNumber,
          manPowerNik: 'EXT-OP-2',
          requestId: randomUUID(),
        }),
      ),
    );
    expect(ok(manpowerRace, 201)).toHaveLength(1);
    expect(manpowerRace.filter((entry) => entry.status >= 400)).toHaveLength(1);
    const winningIndex = manpowerRace.findIndex(
      (response) => response.status === 201,
    );
    const winningLabel = remainingAssemblyLabels[winningIndex];
    const losingLabel = remainingAssemblyLabels[winningIndex === 0 ? 1 : 0];
    let winningSession = responseData<Entity>(manpowerRace[winningIndex].body);
    const completeCancelRace = await Promise.all([
      post(`/production/assembly/${String(winningSession.Id)}/complete`, {
        requestId: randomUUID(),
      }),
      post(`/production/assembly/${String(winningSession.Id)}/cancel`, {
        reason: 'Extreme complete-cancel race',
      }),
    ]);
    expect(ok(completeCancelRace, 200)).toHaveLength(1);
    expect(
      completeCancelRace.filter((response) => response.status >= 400),
    ).toHaveLength(1);
    const terminalWinningSession =
      await prisma.assemblySession.findUniqueOrThrow({
        where: { Id: String(winningSession.Id) },
      });
    if (terminalWinningSession.Status === 'CANCELLED') {
      winningSession = responseData<Entity>(
        (
          await post('/production/assembly/start', {
            labelNumber: winningLabel.LabelNumber,
            manPowerNik: 'EXT-OP-2',
            requestId: randomUUID(),
          }).expect(201)
        ).body,
      );
      await post(`/production/assembly/${String(winningSession.Id)}/complete`, {
        requestId: randomUUID(),
      }).expect(200);
    }
    await post('/production/pokayoke/scan', {
      labelNumber: winningLabel.LabelNumber,
      status: 'SUKSES',
    }).expect(201);
    await post('/production/delivery', {
      labelDataId: winningLabel.Id,
      palletNumber: 'EXT-PALLET-ASSY-RACE-WINNER',
    }).expect(201);

    const losingSession = responseData<Entity>(
      (
        await post('/production/assembly/start', {
          labelNumber: losingLabel.LabelNumber,
          manPowerNik: 'EXT-OP-3',
          requestId: randomUUID(),
        }).expect(201)
      ).body,
    );
    await post(`/production/assembly/${String(losingSession.Id)}/complete`, {
      requestId: randomUUID(),
    }).expect(200);
    await post('/production/pokayoke/scan', {
      labelNumber: losingLabel.LabelNumber,
      status: 'SUKSES',
    }).expect(201);
    await post('/production/delivery', {
      labelDataId: losingLabel.Id,
      palletNumber: 'EXT-PALLET-ASSY-RACE-LOSER',
    }).expect(201);

    await post('/production/pokayoke/scan', {
      labelNumber: passLabels[0].LabelNumber,
      status: 'SUKSES',
    }).expect(201);
    await post('/production/delivery', {
      labelDataId: passLabels[0].Id,
      palletNumber: 'EXT-PALLET-PASS-1',
    }).expect(201);
    const outstandingKey = randomUUID();
    const passSnapshot = snapshots.find(
      (snapshot) => snapshot.ForecastId === 'EXT-PO-PASS',
    )!;
    const outstandingResponse = await post(
      '/production/material-ng-cases',
      {
        requestId: outstandingKey,
        forecastId: 'EXT-PO-PASS',
        snapshotId: passSnapshot.Id,
        stage: 'DELIVERY',
        reason: 'Extreme outstanding replacement',
        lines: [
          {
            materialId: 'EXT-MAT-PASS',
            qtyNg: 1,
            qtyReplacement: 1,
          },
        ],
      },
      'extreme-admin',
      outstandingKey,
    ).expect(201);
    const outstanding = responseData<Entity>(outstandingResponse.body);

    await post('/production/pokayoke/scan', {
      labelNumber: passLabels[1].LabelNumber,
      status: 'SUKSES',
    }).expect(201);

    const closeRace = await Promise.all([
      post('/production/delivery', {
        labelDataId: passLabels[1].Id,
        palletNumber: 'EXT-PALLET-PASS-2',
      }),
      patch(`/production/production-release/${String(release.Id)}`, {
        status: 'COMPLETED',
        totalProductionMinutes: 90,
      }),
    ]);
    expect(closeRace[0].status).toBe(201);
    expect([400, 409]).toContain(closeRace[1].status);
    const closeNgKey = randomUUID();
    await post(
      `/production/material-ng-cases/${String(outstanding.Id)}/close`,
      {
        requestId: closeNgKey,
        reason: 'Cancelled by extreme test after close gate assertion',
        action: 'CANCEL',
      },
      'extreme-admin',
      closeNgKey,
    ).expect(201);
    let completedRelease = await prisma.productionRelease.findUniqueOrThrow({
      where: { Id: String(release.Id) },
    });
    if (completedRelease.Status !== 'COMPLETED') {
      await patch(`/production/production-release/${String(release.Id)}`, {
        status: 'COMPLETED',
        totalProductionMinutes: 90,
      }).expect(200);
      completedRelease = await prisma.productionRelease.findUniqueOrThrow({
        where: { Id: String(release.Id) },
      });
    }
    expect(completedRelease.Status).toBe('COMPLETED');
    expect(completedRelease.TotalTargetQty).toBe(19);
    expect(completedRelease.TotalGoodQty).toBe(19);
    expect(await prisma.deliveryHistory.count()).toBe(5);
    expect(
      (
        await prisma.deliveryHistory.aggregate({
          _sum: { Qty: true },
        })
      )._sum.Qty,
    ).toBe(19);
    expect(
      await prisma.inventoryLedger.count({
        where: { TransactionType: 'DELIVERY_TO_CUSTOMER' },
      }),
    ).toBe(5);
    expect(
      await prisma.productionTraceEvent.count({
        where: { ReleaseId: String(release.Id) },
      }),
    ).toBeGreaterThan(0);
    expect(await prisma.labelData.count({ where: { Scanned: true } })).toBe(5);
    expect(
      await prisma.inventoryLedger.aggregate({
        where: {
          FinishGoodId: 'EXT-FG-ASSY',
          TransactionType: 'PRODUCTION_RESULT',
        },
        _sum: { QtyIn: true },
      }),
    ).toMatchObject({ _sum: { QtyIn: 12 } });
    expect(
      await prisma.actionAuditEvent.count({
        where: {
          SourceType: 'InventoryLedger',
          OR: [{ Actor: null }, { RequestId: null }, { ProcessId: null }],
        },
      }),
    ).toBe(0);
    expect(
      await prisma.productionTraceEvent.count({
        where: { ProcessId: null },
      }),
    ).toBe(0);
    expect(
      await prisma.businessCommand.count({
        where: {
          OR: [{ Actor: '' }, { RequestId: '' }],
        },
      }),
    ).toBe(0);
    const leakedCredential = await prisma.logProcessDetail.findFirst({
      where: {
        OR: [
          { Message: { contains: 'Bearer extreme-' } },
          { Message: { contains: 'extreme-admin@example.invalid' } },
        ],
      },
    });
    expect(leakedCredential).toBeNull();
    await assertInventoryIntegrity(prisma);
  });
});
