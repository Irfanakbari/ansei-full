import * as pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import { TDocumentDefinitions } from "pdfmake/interfaces";
import { PDFDocument } from "pdf-lib";

export interface PartTagPayload {
  poId: string;
  qtyOrder: number;
  partNumber: string;
  partName: string;
  vendorCode: string;
  classificationCode: string;
  deliveryDate: string | Date;
  qtyPerbox: number;
  poNumber: string;
  receivingArea: string;
}

(pdfMake as any).vfs = (pdfFonts as any).pdfMake
  ? (pdfFonts as any).pdfMake.vfs
  : (pdfFonts as any).vfs;

export class PartTagPdfRenderer {
  private getBuffer(pdfDoc: any): Promise<Buffer> {
    return new Promise((resolve) => {
      pdfDoc.getBuffer((buffer: Buffer) => {
        resolve(buffer);
      });
    });
  }

  async generatePartTagPdf(partTag: PartTagPayload): Promise<Buffer> {
    const pdfBuffers: Buffer[] = [];
    const totalTags = Math.ceil(partTag.qtyOrder / partTag.qtyPerbox);

    for (let i = 0; i < totalTags; i++) {
      const qtyInBox =
        i === totalTags - 1
          ? partTag.qtyOrder % partTag.qtyPerbox || partTag.qtyPerbox
          : partTag.qtyPerbox;

      const boxNumber = String(i + 1).padStart(3, "0"); // 3 digit nomor box
      const qtyInBoxString = String(qtyInBox).padStart(5, "0"); // 5 digit qty box
      const label_number = `${partTag.poId}${boxNumber}${qtyInBoxString}`;

      const dd: TDocumentDefinitions = {
        pageSize: "A7",
        pageOrientation: "landscape",
        pageMargins: [0, 0, 0, 0],
        content: [
          {
            alignment: "center",
            style: "tableContent",
            table: {
              widths: ["*", "*", "auto", "auto"],
              heights: ["auto", "auto", "auto", "auto"],
              headerRows: 2,
              body: this.createTableBody(
                partTag,
                qtyInBox,
                i + 1,
                label_number,
              ) as any,
            },
          },
        ],
        styles: {
          header: {
            fontSize: 8,
            bold: true,
            alignment: "left",
            margin: [1, 1, 1, 1],
          },
          tableHeader: {
            fontSize: 8,
            bold: true,
            alignment: "left",
            margin: [1, 1, 1, 1],
          },
          tableContent: { fontSize: 8, margin: [1, 1, 1, 1] },
        },
      };

      const pdfDoc = pdfMake.createPdf(dd);
      const pdfBuffer = await this.getBuffer(pdfDoc);
      pdfBuffers.push(pdfBuffer);
    }

    const mergedPdf = await PDFDocument.create();

    for (const buffer of pdfBuffers) {
      const pdf = await PDFDocument.load(buffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => {
        mergedPdf.addPage(page);
      });
    }

    const finalBytes = await mergedPdf.save();
    return Buffer.from(finalBytes);
  }

  private createTableBody(
    partTag: PartTagPayload,
    qtyInBox: number,
    boxNumber: number,
    labelNumber: string,
  ) {
    const deliveryDateStr =
      typeof partTag.deliveryDate === "string"
        ? new Date(partTag.deliveryDate).toLocaleDateString("id-ID")
        : partTag.deliveryDate.toLocaleDateString("id-ID");

    return [
      [
        {
          width: 35,
          height: 15,
          alignment: "center",
          border: [true, true, false, false],
          colSpan: 1,
          image:
            "data:image/png;base64,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",
        },
        {
          text: "PT VUTEQ INDONESIA",
          style: "tableHeader",
          fontSize: 10,
          border: [false, true, true, true],
          bold: true,
          colSpan: 2,
          alignment: "left",
        },
        {},
        {
          text: `Delivery Date \n \n ${deliveryDateStr}`,
          style: "tableHeader",
          colSpan: 1,
          alignment: "left",
        },
      ],
      [
        {
          text: `Part Number \n \n ${partTag.partNumber}`,
          style: "tableHeader",
          alignment: "left",
        },
        {
          text: `Part Name \n \n ${partTag.partName}`,
          style: "tableHeader",
          colSpan: 2,
          alignment: "left",
        },
        {},
        {
          text: `Receiving Area \n \n ${partTag.receivingArea}`,
          style: "tableHeader",
          alignment: "left",
        },
      ],
      [
        {
          text: `Qty In Box \n \n ${qtyInBox} (Box ${boxNumber})`,
          style: "tableHeader",
          alignment: "left",
        },
        {
          text: `Qty Order \n \n ${partTag.qtyOrder}`,
          style: "tableHeader",
          alignment: "left",
        },
        {
          text: `Classification \n \n ${partTag.classificationCode}`,
          style: "tableHeader",
          alignment: "left",
        },
        {
          text: `Shelf No. \n \n AN01`,
          style: "tableHeader",
          alignment: "left",
        },
      ],
      [
        {
          text: `Vendor \n \n ${partTag.vendorCode} - PT ANSEI INDONESIA JAYA`,
          style: "tableHeader",
          alignment: "left",
          colSpan: 3,
        },
        {},
        {},
        {
          text: `PO Number \n \n ${partTag.poNumber}`,
          style: "tableHeader",
          colSpan: 1,
          alignment: "left",
        },
      ],
      [
        {
          colSpan: 2,
          margin: [0, 0, 0, 0],
          fit: 45,
          qr: partTag.poId,
          border: [true, true, true, false],
          alignment: "center",
        },
        {},
        {
          colSpan: 2,
          margin: [0, 0, 0, 0],
          border: [true, true, true, false],
          fit: 45,
          qr: labelNumber,
          alignment: "center",
        },
        {},
      ],
      [
        {
          colSpan: 2,
          bold: true,
          border: [true, false, true, true],
          alignment: "center",
          fontSize: 8,
          margin: [0, 0, 0, 0],
          text: `${partTag.poId}`,
        },
        {},
        {
          colSpan: 2,
          bold: true,
          margin: [0, 0, 0, 0],
          border: [true, false, true, true],
          alignment: "center",
          fontSize: 8,
          text: `${labelNumber}`,
        },
        {},
      ],
    ];
  }
}
