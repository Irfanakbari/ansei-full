import { PrinterService } from './printer.service';
import { auditContext } from '../helpers/audit-context.helper';
describe('PrinterService', () => {
  it('does not emit an untracked print command', async () => {
    const service = new PrinterService({} as never, {} as never);
    await expect(
      service.printPartTagAnsei({} as never, 'actor'),
    ).rejects.toThrow('command identity');
  });
  it('rejects HTTP calls without a retained key before touching a queue or database', async () => {
    const service = new PrinterService({} as never, {} as never);
    await expect(
      auditContext.run({ requestId: 'fixture' }, () =>
        service.printPartTagAnsei({} as never, 'actor'),
      ),
    ).rejects.toThrow('Idempotency-Key');
  });
});
