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

    // Very simple check if it's an HTTP URL (likely IPP)
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
          this.logger.error(`IPP Print failed: ${err.message}`, err.stack);
          return reject(err);
        }

        if (res.statusCode !== "successful-ok") {
          this.logger.warn(
            `IPP Print returned non-success status: ${res.statusCode}`,
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
    port: number = 9100,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();

      client.setTimeout(10000); // 10 seconds timeout

      client.connect(port, printerIp, () => {
        this.logger.log(`Connected to raw printer at ${printerIp}:${port}`);
        client.write(buffer, (err) => {
          if (err) {
            this.logger.error(
              `Error writing to raw printer at ${printerIp}: ${err.message}`,
            );
            client.destroy();
            return reject(err);
          }
          this.logger.log(
            `Successfully sent data to raw printer at ${printerIp}:${port}`,
          );
          client.end();
          resolve();
        });
      });

      client.on("error", (err) => {
        this.logger.error(
          `Socket error communicating with printer ${printerIp}: ${err.message}`,
        );
        reject(err);
      });

      client.on("timeout", () => {
        this.logger.error(`Timeout communicating with printer ${printerIp}`);
        client.destroy();
        reject(new Error(`Timeout connecting to printer ${printerIp}`));
      });
    });
  }
}
