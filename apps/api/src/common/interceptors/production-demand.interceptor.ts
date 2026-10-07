import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs';

/** Keep the established PO response aliases while exposing generic order identity. */
export function withDemandIdentity(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withDemandIdentity);
  if (
    !value ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return value;
  const row = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, withDemandIdentity(item)]),
  );
  if ('ProductionDemandId' in row) {
    row.demandId = row.ProductionDemandId;
    // A compatibility response alias, never a physical legacy PO foreign key.
    row.ForecastId = row.ProductionDemandId;
  }
  if (row.SourceType === 'PO' || row.SourceType === 'NON_PO')
    row.sourceType = row.SourceType;
  if (
    typeof row.PoId === 'string' &&
    ('FinishGoodId' in row ||
      row.SourceType === 'PO' ||
      row.SourceType === 'NON_PO')
  ) {
    row.demandId = row.PoId;
    row.referenceNumber = row.PoId;
    if (typeof row.PoNumber === 'string') row.poNumber = row.PoNumber || null;
  }
  if (
    typeof row.ReferenceNumber === 'string' &&
    typeof row.DeliveryPeriod === 'number' &&
    typeof row.PartNumber === 'string'
  ) {
    row.referenceNumber = row.ReferenceNumber;
    row.demandId = row.ReferenceNumber;
    row.sourceType = 'NON_PO';
    row.poNumber = row.PoNumber ?? null;
  }
  return row;
}

@Injectable()
export class ProductionDemandInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map(withDemandIdentity));
  }
}
