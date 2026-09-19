import { PrinterProcessor } from "./printer.processor";
describe("PrinterProcessor durable send fence", () => {
  const fixture = () => {
    const pdf = {
      generatePartTagPdf: jest.fn().mockResolvedValue(Buffer.from("test")),
    };
    const transport = { printPdf: jest.fn() };
    const setting = {
      getActivePrinterIp: jest.fn().mockResolvedValue("127.0.0.1"),
    };
    const receipt = { transition: jest.fn().mockResolvedValue(true) };
    return {
      pdf,
      transport,
      receipt,
      processor: new PrinterProcessor(
        pdf as never,
        transport as never,
        setting as never,
        receipt as never,
      ),
      job: {
        id: "event-1",
        name: "printPartTagAnsei",
        data: { outboxEventId: "event", outboxAttempt: 1 },
      },
    };
  };
  it("requires a committed fence before calling the physical transport", async () => {
    const f = fixture();
    f.transport.printPdf.mockImplementation(() => {
      expect(f.receipt.transition).toHaveBeenCalledWith(
        "event",
        1,
        "OUTBOX_PRINT_READY",
        "SENDING",
      );
    });
    await f.processor.process(f.job as never);
    expect(f.receipt.transition).toHaveBeenLastCalledWith(
      "event",
      1,
      "OUTBOX_SENDING",
      "SUCCEEDED",
    );
  });
  it("does not send again after a stalled job replays an existing send marker", async () => {
    const f = fixture();
    f.receipt.transition.mockResolvedValue(false);
    await f.processor.process(f.job as never);
    expect(f.transport.printPdf).not.toHaveBeenCalled();
  });
  it("records ambiguity after a transport timeout without blind retries", async () => {
    const f = fixture();
    f.transport.printPdf.mockRejectedValue(new Error("timeout"));
    await expect(f.processor.process(f.job as never)).rejects.toThrow(
      "uncertain",
    );
    expect(f.receipt.transition).toHaveBeenLastCalledWith(
      "event",
      1,
      "OUTBOX_SENDING",
      "UNCERTAIN",
    );
  });
  it("rejects untracked legacy jobs", async () => {
    const f = fixture();
    await expect(
      f.processor.process({ ...f.job, data: {} } as never),
    ).rejects.toThrow("Tracked");
    expect(f.transport.printPdf).not.toHaveBeenCalled();
  });
});
