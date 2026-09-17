import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { SmtpService } from '../utils/smtp.service';
import { MaterialDeliveryNoteService } from '../../material-delivery-note/material-delivery-note.service';
import {
  PRINT_PART_TAG_ANSEI,
  type PartTagAnseiPayload,
} from '../printer/printer.types';
import {
  type DeliveryNoteEmailPayload,
  DISPATCH_OUTBOX_EVENT,
  type OutboxJobPayload,
  OUTBOX_QUEUE,
} from './outbox.types';

function partTagPayload(value: unknown): PartTagAnseiPayload {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid print payload');
  }
  const payload = value as Record<string, unknown>;
  const required = [
    'poId',
    'qtyOrder',
    'partNumber',
    'partName',
    'vendorCode',
    'classificationCode',
    'deliveryDate',
    'qtyPerbox',
    'poNumber',
    'receivingArea',
  ];
  if (required.some((key) => payload[key] === undefined)) {
    throw new Error('Invalid print payload');
  }
  return {
    poId: String(payload.poId),
    qtyOrder: Number(payload.qtyOrder),
    partNumber: String(payload.partNumber),
    partName: String(payload.partName),
    vendorCode: String(payload.vendorCode),
    classificationCode: String(payload.classificationCode),
    deliveryDate: new Date(String(payload.deliveryDate)),
    qtyPerbox: Number(payload.qtyPerbox),
    poNumber: String(payload.poNumber),
    receivingArea: String(payload.receivingArea),
  };
}

@Injectable()
@Processor(OUTBOX_QUEUE)
export class OutboxProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smtp: SmtpService,
    private readonly deliveryNotes: MaterialDeliveryNoteService,
    @InjectQueue('printer_queue') private readonly printerQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<OutboxJobPayload>): Promise<void> {
    if (job.name !== DISPATCH_OUTBOX_EVENT) return;
    const claimed = await this.prisma.outboxEvent.updateMany({
      where: { Id: job.data.eventId, Status: 'QUEUED' },
      data: {
        Status: 'PROCESSING',
        ProcessingAt: new Date(),
        Attempts: { increment: 1 },
      },
    });
    if (claimed.count === 0) return;
    const event = await this.prisma.outboxEvent.findUniqueOrThrow({
      where: { Id: job.data.eventId },
    });
    try {
      if (event.Type === 'PRINT_PART_TAG_ANSEI') {
        await this.printerQueue.add(
          PRINT_PART_TAG_ANSEI,
          partTagPayload(event.Payload),
          {
            jobId: event.Id,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: false,
            removeOnFail: false,
          },
        );
      } else {
        const payload = event.Payload as unknown as DeliveryNoteEmailPayload;
        const pdfBuffer = await this.deliveryNotes.generateDeliveryNotePDF(
          payload.deliveryNoteId,
        );
        const dn = await this.prisma.materialDeliveryNote.findUniqueOrThrow({
          where: { Id: payload.deliveryNoteId },
        });
        const result = await this.smtp.sendDeliveryNoteEmail({
          to: payload.to,
          cc: payload.cc,
          deliveryNoteNum: dn.DeliveryNoteNum,
          destination: dn.Destination,
          pdfBuffer,
          sentBy: payload.sentBy,
        });
        if (!result.success)
          throw new Error('Email provider rejected the request');
      }
      await this.prisma.outboxEvent.updateMany({
        where: { Id: event.Id, Status: 'PROCESSING' },
        data: {
          Status: 'SUCCEEDED',
          SucceededAt: new Date(),
          LastError: null,
          LastErrorCode: null,
        },
      });
    } catch {
      const exhausted = event.Attempts + 1 >= event.MaxAttempts;
      const delay = Math.min(300000, 5000 * 2 ** Math.max(event.Attempts, 0));
      await this.prisma.outboxEvent.updateMany({
        where: { Id: event.Id, Status: 'PROCESSING' },
        data: {
          Status: 'FAILED',
          NextAttemptAt: new Date(Date.now() + delay),
          LastErrorCode: exhausted
            ? 'OUTBOX_RETRIES_EXHAUSTED'
            : 'OUTBOX_DISPATCH_FAILED',
          LastError: exhausted
            ? 'Delivery failed after the maximum number of attempts'
            : 'Delivery failed and will be retried',
          FailedAt: exhausted ? new Date() : null,
        },
      });
    }
  }
}
