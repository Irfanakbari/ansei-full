import { PDFDocument } from "pdf-lib";
import {
  A7_LANDSCAPE_HEIGHT_PT,
  A7_LANDSCAPE_WIDTH_PT,
  PartTagPdfRenderer,
  type PartTagPayload,
} from "@ansei/label-renderer";
import {
  EPSON_CARRIER_HEIGHT_PT,
  EPSON_CARRIER_WIDTH_PT,
  PartTagPdfService,
} from "./part-tag-pdf.service";

const payload: PartTagPayload = {
  poId: "PO-2026-000001",
  qtyOrder: 20,
  partNumber: "PART-001",
  partName: "Instrument Panel Component",
  vendorCode: "VENDOR-001",
  classificationCode: "REGULAR",
  deliveryDate: "2026-09-28",
  qtyPerbox: 20,
  poNumber: "ORDER-001",
  receivingArea: "ANSEI RECEIVING",
};

const expectPages = async (
  buffer: Buffer,
  expectedCount: number,
  expectedWidth: number,
  expectedHeight: number,
) => {
  const pdf = await PDFDocument.load(buffer);
  expect(pdf.getPageCount()).toBe(expectedCount);
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    expect(width).toBeCloseTo(expectedWidth, 1);
    expect(height).toBeCloseTo(expectedHeight, 1);
  }
};

describe("PartTagPdfRenderer", () => {
  const renderer = new PartTagPdfRenderer();

  it("renders one box as exactly one A7 landscape page", async () => {
    await expectPages(
      await renderer.generatePartTagPdf(payload),
      1,
      A7_LANDSCAPE_WIDTH_PT,
      A7_LANDSCAPE_HEIGHT_PT,
    );
  });

  it("keeps long field values on one A7 page", async () => {
    await expectPages(
      await renderer.generatePartTagPdf({
        ...payload,
        partNumber: "LONG-PART-NUMBER-1234567890-ABCDEFGHIJKLMN",
        partName:
          "A very long production component name that must remain inside the printable label area without creating another page",
        vendorCode: "LONG-VENDOR-CODE-1234567890",
        classificationCode: "ADDITIONAL-PRODUCTION-CLASSIFICATION",
        poNumber: "LONG-PO-NUMBER-1234567890-ABCDEFGHIJKLMN",
        receivingArea: "WAREHOUSE RECEIVING AREA WITH A LONG DESCRIPTION",
      }),
      1,
      A7_LANDSCAPE_WIDTH_PT,
      A7_LANDSCAPE_HEIGHT_PT,
    );
  });

  it("renders exactly one A7 page per calculated box", async () => {
    await expectPages(
      await renderer.generatePartTagPdf({
        ...payload,
        qtyOrder: 101,
        qtyPerbox: 20,
      }),
      6,
      A7_LANDSCAPE_WIDTH_PT,
      A7_LANDSCAPE_HEIGHT_PT,
    );
  });
});

describe("PartTagPdfService", () => {
  const service = new PartTagPdfService();

  it("places each A7 label on one Epson-compatible carrier page", async () => {
    await expectPages(
      await service.generatePartTagPdf(payload),
      1,
      EPSON_CARRIER_WIDTH_PT,
      EPSON_CARRIER_HEIGHT_PT,
    );
  });

  it("preserves one carrier page per calculated box", async () => {
    await expectPages(
      await service.generatePartTagPdf({
        ...payload,
        qtyOrder: 101,
        qtyPerbox: 20,
      }),
      6,
      EPSON_CARRIER_WIDTH_PT,
      EPSON_CARRIER_HEIGHT_PT,
    );
  });
});
