/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { createServer } from "node:net";
import * as ipp from "ipp";
import { IpPrinterService } from "./ip-printer.service";
jest.mock("ipp", () => ({ Printer: jest.fn() }));
describe("Printer transport evidence", () => {
  it("rejects an IPP error response rather than reporting success", async () => {
    jest.mocked(ipp.Printer).mockImplementation(
      () =>
        ({
          execute: (
            _operation: unknown,
            _message: unknown,
            callback: (error: null, response: { statusCode: string }) => void,
          ) => callback(null, { statusCode: "server-error-internal-error" }),
        }) as never,
    );
    await expect(
      new IpPrinterService().printPdf(
        Buffer.from("fixture"),
        "http://127.0.0.1:631/printers/fixture",
      ),
    ).rejects.toThrow("did not accept");
  });
  it("transmits fixture bytes through an actual local TCP socket", async () => {
    const oldPort = process.env.PRINTER_RAW_PORT;
    let accept: (value: Buffer) => void = () => undefined;
    const received = new Promise<Buffer>((resolve) => {
      accept = resolve;
    });
    const server = createServer((socket) => {
      const chunks: Buffer[] = [];
      socket.on("data", (chunk) => chunks.push(chunk));
      socket.on("end", () => accept(Buffer.concat(chunks)));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("No local fixture port");
    process.env.PRINTER_RAW_PORT = String(address.port);
    try {
      await new IpPrinterService().printPdf(
        Buffer.from("fixture"),
        "127.0.0.1",
      );
      expect((await received).toString()).toBe("fixture");
    } finally {
      if (oldPort === undefined) delete process.env.PRINTER_RAW_PORT;
      else process.env.PRINTER_RAW_PORT = oldPort;
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
