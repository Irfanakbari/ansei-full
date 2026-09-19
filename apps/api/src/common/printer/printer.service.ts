/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { BadRequestException, Injectable } from '@nestjs/common';
import type { PartTagAnseiPayload } from './printer.types';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import type { SafeOutboxEvent } from '../outbox/outbox.types';
import { auditedTransaction } from '../helpers/audited-transaction.helper';
import {
  claimCommand,
  finishCommand,
  requestCommandKey,
} from '../helpers/business-command.helper';
@Injectable()
export class PrinterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}
  async printPartTagAnsei(
    payload: PartTagAnseiPayload,
    actor: string,
  ): Promise<SafeOutboxEvent> {
    const key = requestCommandKey();
    if (!key)
      throw new BadRequestException(
        'A retained print command identity is required.',
      );
    return auditedTransaction(this.prisma, async (tx) => {
      const claim = await claimCommand(
        tx,
        'MANUAL_PRINT_TAG',
        key,
        actor,
        payload,
      );
      if (claim.duplicate)
        return claim.command.Result as unknown as SafeOutboxEvent;
      const event = await this.outbox.create(tx, {
        idempotencyKey: `manual-print:${claim.command.Id}`,
        type: 'PRINT_PART_TAG_ANSEI',
        payload,
        actor,
        referenceType: 'FORECAST',
        referenceId: payload.poId,
      });
      const result = OutboxService.safeEvent(event);
      await finishCommand(tx, claim.command.Id, result);
      return result;
    });
  }
}
