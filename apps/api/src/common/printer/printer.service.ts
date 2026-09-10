import { Inject, Injectable } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import {
  PRINT_PART_TAG_ANSEI,
  PRINTER_SERVICE,
  type PartTagAnseiPayload,
} from './printer.types';

@Injectable()
export class PrinterService {
  constructor(@Inject(PRINTER_SERVICE) private readonly client: ClientProxy) {}

  async printPartTagAnsei(payload: PartTagAnseiPayload): Promise<void> {
    await lastValueFrom(this.client.emit(PRINT_PART_TAG_ANSEI, payload));
  }
}
