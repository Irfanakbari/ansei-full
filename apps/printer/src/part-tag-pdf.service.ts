import { Injectable } from "@nestjs/common";
import {
  A7_LANDSCAPE_HEIGHT_PT,
  A7_LANDSCAPE_WIDTH_PT,
  PartTagPdfRenderer,
  type PartTagPayload,
} from "@ansei/label-renderer";
import { PDFDocument } from "pdf-lib";

export const EPSON_CARRIER_WIDTH_PT = 360;
export const EPSON_CARRIER_HEIGHT_PT = 252;

@Injectable()
export class PartTagPdfService extends PartTagPdfRenderer {
  override async generatePartTagPdf(partTag: PartTagPayload): Promise<Buffer> {
    const a7Buffer = await super.generatePartTagPdf(partTag);
    const source = await PDFDocument.load(a7Buffer);
    const carrier = await PDFDocument.create();
    const embeddedPages = await carrier.embedPdf(
      a7Buffer,
      source.getPageIndices(),
    );
    const x = (EPSON_CARRIER_WIDTH_PT - A7_LANDSCAPE_WIDTH_PT) / 2;

    for (const embeddedPage of embeddedPages) {
      const page = carrier.addPage([
        EPSON_CARRIER_WIDTH_PT,
        EPSON_CARRIER_HEIGHT_PT,
      ]);
      page.drawPage(embeddedPage, {
        x,
        y: 0,
        width: A7_LANDSCAPE_WIDTH_PT,
        height: A7_LANDSCAPE_HEIGHT_PT,
      });
    }

    return Buffer.from(await carrier.save());
  }
}
