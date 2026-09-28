import { PDFDocument } from "pdf-lib";
import {
  A7_LANDSCAPE_HEIGHT_PT,
  A7_LANDSCAPE_WIDTH_PT,
  PartTagPdfRenderer,
  type PartTagPayload,
} from "@ansei/label-renderer";

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

const expectA7Pages = async (buffer: Buffer, expectedCount: number) => {
  const pdf = await PDFDocument.load(buffer);
  expect(pdf.getPageCount()).toBe(expectedCount);
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    expect(width).toBeCloseTo(A7_LANDSCAPE_WIDTH_PT, 1);
    expect(height).toBeCloseTo(A7_LANDSCAPE_HEIGHT_PT, 1);
  }
};

describe("PartTagPdfRenderer", () => {
  const renderer = new PartTagPdfRenderer();

  it("renders one box as exactly one A7 landscape page", async () => {
    await expectA7Pages(await renderer.generatePartTagPdf(payload), 1);
  });

  it("keeps long field values on one A7 page", async () => {
    await expectA7Pages(
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
    );
  });

  it("renders exactly one page per calculated box", async () => {
    await expectA7Pages(
      await renderer.generatePartTagPdf({
        ...payload,
        qtyOrder: 101,
        qtyPerbox: 20,
      }),
      6,
    );
  });
});
