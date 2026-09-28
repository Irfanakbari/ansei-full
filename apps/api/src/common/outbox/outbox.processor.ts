import { integrationDeadline } from './integration-deadline';
import { OutboxService } from './outbox.service';
/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { SmtpService } from '../utils/smtp.service';
import { MaterialDeliveryNoteService } from '../../material-delivery-note/material-delivery-note.service';
import {
  PRINT_PART_TAG_ANSEI,
  type PartTagAnseiPayload,
} from '../printer/printer.types';
import {
  type DeliveryNoteEmailPayload,
  type PalletConnectorHistoryPayload,
  DISPATCH_OUTBOX_EVENT,
  type OutboxJobPayload,
  OUTBOX_QUEUE,
} from './outbox.types';
import {
  OutboxStateService,
  PRINT_READY,
  SENDING,
  SAFE_RETRY,
  UNCERTAIN,
} from './outbox-state.service';

function printPayload(value: unknown): PartTagAnseiPayload {
  const data = value as PartTagAnseiPayload;
  if (
    !data ||
    typeof data !== 'object' ||
    !Number.isInteger(data.qtyOrder) ||
    data.qtyOrder <= 0 ||
    !Number.isInteger(data.qtyPerbox) ||
    data.qtyPerbox <= 0 ||
    [
      'poId',
      'partNumber',
      'partName',
      'vendorCode',
      'classificationCode',
      'poNumber',
      'receivingArea',
    ].some(
      (key) =>
        typeof (data as unknown as Record<string, unknown>)[key] !== 'string',
    ) ||
    !Number.isFinite(new Date(data.deliveryDate).getTime())
  )
    throw new Error('Invalid print payload');
  return { ...data, deliveryDate: new Date(data.deliveryDate) };
}
@Injectable()
@Processor(OUTBOX_QUEUE)
export class OutboxProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smtp: SmtpService,
    private readonly deliveryNotes: MaterialDeliveryNoteService,
    private readonly state: OutboxStateService,
  ) {
    super();
  }
  async process(job: Job<OutboxJobPayload>): Promise<void> {
    if (job.name !== DISPATCH_OUTBOX_EVENT) return;
    const queued = await this.prisma.outboxEvent.findUnique({
      where: { Id: job.data.eventId },
    });
    if (
      !queued ||
      queued.Status !== 'QUEUED' ||
      queued.Attempts !== job.data.attempt
    )
      return;
    let event = await this.state.change(
      queued,
      {
        Status: 'PROCESSING',
        ProcessingAt: new Date(),
        LastErrorCode: 'OUTBOX_PREPARING',
      },
      'PREPARE',
    );
    if (!event) return;
    let externalStarted = false;
    try {
      if (event.Type === 'PRINT_PART_TAG_ANSEI') {
        const payload = printPayload(event.Payload);
        event = await this.state.change(
          event,
          { LastErrorCode: PRINT_READY },
          'PRINT_READY',
        );
        if (!event) return;
        const printDb = this.prisma as unknown as {
          profilePrinter: {
            findFirst(input: object): Promise<{
              Id: string;
              AgentId: string;
              ProfileSnapshot: object;
            } | null>;
          };
          $transaction<T>(
            fn: (tx: {
              printJob: { create(input: object): Promise<{ Id: string }> };
              printJobEvent: { create(input: object): Promise<unknown> };
            }) => Promise<T>,
          ): Promise<T>;
        };
        const outboxEventId = event.Id;
        const profile = await printDb.profilePrinter.findFirst({
          where: {
            DocumentType: 'PART_TAG_ANSEI',
            Status: 'READY',
            IsDefault: true,
            Agent: { Status: 'ACTIVE' },
          },
          orderBy: { UpdatedAt: 'desc' },
        });
        if (!profile) throw new Error('No default ready print profile');
        await printDb.$transaction(async (tx) => {
          const printJob = await tx.printJob.create({
            data: {
              OutboxEventId: outboxEventId,
              ProfileId: profile.Id,
              AgentId: profile.AgentId,
              DocumentType: 'PART_TAG_ANSEI',
              PayloadSnapshot: payload,
              ProfileSnapshot: profile.ProfileSnapshot,
            },
          });
          await tx.printJobEvent.create({
            data: {
              JobId: printJob.Id,
              Type: 'CREATED',
              ToStatus: 'QUEUED',
              Attempt: 0,
            },
          });
        });
        return;
      }
      if (event.Type === 'PALLET_CONNECTOR_HISTORY') {
        const payload =
          event.Payload as unknown as PalletConnectorHistoryPayload;
        if (
          !payload ||
          typeof payload.kode !== 'string' ||
          !payload.kode.trim()
        ) {
          throw new Error('Invalid pallet connector history payload');
        }
        event = await this.state.change(
          event,
          { LastErrorCode: SENDING },
          'SEND',
        );
        if (!event) return;
        externalStarted = true;
        const historiesUrl =
          process.env.PALLET_CONNECTOR_HISTORIES_URL ||
          'https://apps2.vuteq.co.id/connector/v2/histories';
        const apiKey = process.env.PALLET_CONNECTOR_API_KEY?.trim();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (apiKey) {
            headers['x-api-key'] = apiKey;
          }
          const res = await fetch(historiesUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ kode: payload.kode.trim() }),
            signal: controller.signal,
          });
          if (!res.ok) {
            const errorBody = await res.text().catch(() => '');
            throw new Error(
              `Connector histories endpoint responded with HTTP ${res.status}: ${errorBody.slice(0, 200)}`,
            );
          }
        } finally {
          clearTimeout(timeout);
        }
        await this.state.change(
          event,
          {
            Status: 'SUCCEEDED',
            SucceededAt: new Date(),
            LastErrorCode: 'OUTBOX_TRANSPORT_ACCEPTED',
            LastError: null,
          },
          'TRANSPORT_ACCEPTED',
        );
        return;
      }
      const payload = event.Payload as unknown as DeliveryNoteEmailPayload;
      if (
        !payload ||
        typeof payload.deliveryNoteId !== 'string' ||
        !Array.isArray(payload.to) ||
        !payload.to.length
      )
        throw new Error('Invalid email payload');
      const readDocument = () =>
        this.prisma.materialDeliveryNote.findUniqueOrThrow({
          where: { Id: payload.deliveryNoteId },
          include: {
            Details: {
              select: {
                MaterialId: true,
                FinishGoodPartTemp: true,
                QtyRequested: true,
                QtyPicking: true,
                QtyReceived: true,
              },
              orderBy: { Id: 'asc' },
            },
          },
        });
      const dn = await readDocument();
      const matchesVersion = (value: typeof dn) =>
        OutboxService.fingerprint([
          value.DeliveryNoteNum,
          value.Destination,
          value.Status,
          value.CreatedAt,
          value.ShippedAt,
          value.ReceivedAt,
          value.Details,
        ]) === payload.documentVersion;
      if (!matchesVersion(dn)) {
        await this.state.change(
          event,
          {
            Status: 'FAILED',
            FailedAt: new Date(),
            LastErrorCode: 'OUTBOX_DOCUMENT_CHANGED',
            LastError:
              'Delivery note changed. Review and submit a new email request.',
          },
          'DOCUMENT_CHANGED',
        );
        return;
      }
      const pdfBuffer = await this.deliveryNotes.generateDeliveryNotePDF(
        payload.deliveryNoteId,
      );
      if (!matchesVersion(await readDocument())) {
        await this.state.change(
          event,
          {
            Status: 'FAILED',
            FailedAt: new Date(),
            LastErrorCode: 'OUTBOX_DOCUMENT_CHANGED',
            LastError:
              'Delivery note changed during preparation. Submit a new reviewed email request.',
          },
          'DOCUMENT_CHANGED',
        );
        return;
      }
      // Durable fence before SMTP. Crash/timeout after this point must be reconciled, never blindly retried.
      event = await this.state.change(
        event,
        { LastErrorCode: SENDING },
        'SEND',
      );
      if (!event) return;
      externalStarted = true;
      const result = await this.smtp.sendDeliveryNoteEmail({
        to: payload.to,
        cc: payload.cc,
        deliveryNoteNum: dn.DeliveryNoteNum,
        destination: dn.Destination,
        pdfBuffer,
        sentBy: payload.sentBy,
        subject: payload.subject,
        message: payload.message,
      });
      if (!result.success) throw new Error('SMTP outcome unavailable');
      await this.state.change(
        event,
        {
          Status: 'SUCCEEDED',
          SucceededAt: new Date(),
          LastErrorCode: 'OUTBOX_TRANSPORT_ACCEPTED',
          LastError: null,
        },
        'TRANSPORT_ACCEPTED',
      );
    } catch {
      if (!event) return;
      await this.state.change(
        event,
        {
          Status: 'FAILED',
          FailedAt: new Date(),
          LastErrorCode: externalStarted ? UNCERTAIN : SAFE_RETRY,
          LastError: externalStarted
            ? 'Email delivery outcome requires reconciliation.'
            : 'Preparation failed before external delivery.',
          NextAttemptAt: new Date(
            Date.now() +
              Math.min(300000, 5000 * 2 ** Math.min(event.Attempts - 1, 6)),
          ),
        },
        externalStarted ? 'UNCERTAIN' : 'PREPARATION_FAILED',
      );
    }
  }
}
