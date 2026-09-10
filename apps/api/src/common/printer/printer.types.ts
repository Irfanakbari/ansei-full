export const PRINTER_SERVICE = 'PRINTER_SERVICE';
export const PRINT_PART_TAG_ANSEI = 'printPartTagAnsei';

export interface PartTagAnseiPayload {
  poId: string;
  qtyOrder: number;
  partNumber: string;
  partName: string;
  vendorCode: string;
  classificationCode: string;
  deliveryDate: Date;
  qtyPerbox: number;
  poNumber: string;
  receivingArea: string;
}
