import { Injectable, Logger } from "@nestjs/common";
import * as ipp from "ipp";
import * as net from "net";

@Injectable()
export class IpPrinterService {
  private readonly logger = new Logger(IpPrinterService.name);

  async printPdf(
    pdfBuffer: Buffer,
    printerIpOrUrl: string,
    jobName: string = "ANSEI Print Job",
  ): Promise<void> {
    this.logger.log(`Preparing to print ${jobName} to ${printerIpOrUrl}`);

    // Check if it's an HTTP/IPP URL
    if (
      printerIpOrUrl.startsWith("http://") ||
      printerIpOrUrl.startsWith("https://") ||
      printerIpOrUrl.startsWith("ipp://")
    ) {
      return this.printViaIpp(pdfBuffer, printerIpOrUrl, jobName);
    }

    // Otherwise try TCP raw printing on port 9100 (standard raw printing port)
    return this.printViaRawTcp(pdfBuffer, printerIpOrUrl);
  }

  private printViaIpp(
    buffer: Buffer,
    printerUrl: string,
    jobName: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const printer = new ipp.Printer(printerUrl);
      const msg = {
        "operation-attributes-tag": {
          "requesting-user-name": "ANSEI System",
          "job-name": jobName,
          "document-format": "application/pdf",
        },
        data: buffer,
      };

      printer.execute("Print-Job" as any, msg, (err, res) => {
        if (err) {
          const ippErr = new Error(
            `[IPP Print Error] Gagal mengirim dokumen ke printer ${printerUrl}: ${err.message}. Pastikan service IPP berjalan di port 631 dan URL valid.`,
          );
          (ippErr as any).code = (err as any).code || "EIPP_FAIL";
          this.logger.error(ippErr.message, err.stack);
          return reject(ippErr);
        }

        if (res.statusCode !== "successful-ok") {
          this.logger.warn(
            `[IPP Status Warning] Printer ${printerUrl} mengembalikan status non-success: ${res.statusCode}`,
          );
        } else {
          this.logger.log(
            `IPP Print job submitted successfully to ${printerUrl}. Job ID: ${res["job-attributes-tag"]?.["job-id"] || "unknown"}`,
          );
        }
        resolve();
      });
    });
  }

  private printViaRawTcp(
    buffer: Buffer,
    printerIp: string,
    port: number = Number(process.env.PRINTER_RAW_PORT || 9100),
    timeoutMs: number = Number(process.env.PRINTER_TIMEOUT_MS || 10000),
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      let isFinished = false;

      client.setTimeout(timeoutMs);

      client.connect(port, printerIp, () => {
        this.logger.log(`Connected to raw printer at ${printerIp}:${port}`);
        client.write(buffer, (err) => {
          if (err) {
            isFinished = true;
            client.destroy();
            const writeErr = new Error(
              `[Printer Write Error] Gagal mengirim data buffer (${buffer.length} bytes) ke printer di ${printerIp}:${port}: ${err.message}`,
            );
            (writeErr as any).code = (err as any).code || "EWRITE";
            this.logger.error(writeErr.message);
            return reject(writeErr);
          }
          this.logger.log(
            `Successfully transmitted ${buffer.length} bytes to printer at ${printerIp}:${port}`,
          );
          client.end();
          isFinished = true;
          resolve();
        });
      });

      client.on("error", (err: any) => {
        if (isFinished) return;
        isFinished = true;
        client.destroy();

        let detailedMessage = `[Printer Socket Error] Gagal terhubung ke printer ${printerIp}:${port}: ${err.message}`;
        if (err.code === "ECONNREFUSED") {
          detailedMessage = `[Printer Connection Refused] Koneksi ke ${printerIp}:${port} ditolak (ECONNREFUSED). Perangkat pada IP tersebut aktif, namun port RAW printing ${port} ditolak atau tidak dibuka.`;
        } else if (err.code === "EHOSTUNREACH") {
          detailedMessage = `[Printer Host Unreachable] Alamat IP printer ${printerIp}:${port} tidak dapat dijangkau di jaringan (EHOSTUNREACH). Periksa rute jaringan, subnet, atau kabel LAN printer.`;
        } else if (err.code === "ENETUNREACH") {
          detailedMessage = `[Printer Network Unreachable] Jaringan menuju printer ${printerIp}:${port} tidak dapat dijangkau (ENETUNREACH).`;
        }

        const customErr = new Error(detailedMessage);
        (customErr as any).code = err.code;
        this.logger.error(detailedMessage);
        reject(customErr);
      });

      client.on("timeout", () => {
        if (isFinished) return;
        isFinished = true;
        client.destroy();

        const timeoutMessage =
          `[Printer Timeout] Timeout (${timeoutMs}ms) saat berkomunikasi dengan printer ${printerIp}:${port}. ` +
          `Printer fisik di alamat IP ${printerIp} tidak merespons. ` +
          `Pastikan printer dalam kondisi menyala (ON), kabel jaringan/Wi-Fi terhubung, port ${port} terbuka, dan alamat IP pada menu Printer Setting sudah sesuai.`;

        const timeoutErr = new Error(timeoutMessage);
        (timeoutErr as any).code = "ETIMEDOUT";
        this.logger.error(timeoutMessage);
        reject(timeoutErr);
      });
    });
  }
}
