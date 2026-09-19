/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { createServer, type Server, type Socket } from 'node:net';
import { SmtpService } from './smtp.service';
import type { LogProcessService } from '../log-process/log-process.service';
describe('SMTP local disposable transport', () => {
  let server: Server;
  let port: number;
  let disconnectAfterData = false;
  const sockets = new Set<Socket>();
  const previous = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    secure: process.env.SMTP_SECURE,
  };
  beforeAll(async () => {
    server = createServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      socket.write('220 localhost fixture\r\n');
      let buffer = '';
      let inData = false;
      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        let index: number;
        while ((index = buffer.indexOf('\r\n')) >= 0) {
          const line = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          if (inData) {
            if (line === '.') {
              inData = false;
              if (disconnectAfterData) socket.destroy();
              else socket.write('250 accepted\r\n');
            }
            continue;
          }
          if (line.startsWith('EHLO'))
            socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
          else if (line.startsWith('AUTH'))
            socket.write('235 authenticated\r\n');
          else if (line === 'DATA') {
            inData = true;
            socket.write('354 send fixture\r\n');
          } else if (line === 'QUIT') socket.end('221 bye\r\n');
          else socket.write('250 ok\r\n');
        }
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Fixture address missing');
    port = address.port;
    Object.assign(process.env, {
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(port),
      SMTP_USER: 'fixture',
      SMTP_PASS: 'fixture-only',
      SMTP_SECURE: 'false',
    });
  });
  afterAll(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const [key, value] of Object.entries(previous)) {
      const name = `SMTP_${key.toUpperCase()}`;
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  const fixture = () => {
    const logs = {
      startProcess: jest.fn().mockResolvedValue({ ProcessId: 'fixture' }),
      addLog: jest.fn(),
      completeProcess: jest.fn(),
    };
    return {
      logs,
      smtp: new SmtpService(logs as unknown as LogProcessService),
    };
  };
  it('records transport acceptance through a real local SMTP connection without logging recipients', async () => {
    disconnectAfterData = false;
    const { smtp, logs } = fixture();
    const result = await smtp.sendEmail(
      { to: 'fixture@example.invalid', subject: 'fixture', html: 'fixture' },
      'fixture',
    );
    expect(result.success).toBe(true);
    expect(JSON.stringify(logs.addLog.mock.calls)).not.toContain(
      'fixture@example.invalid',
    );
  });
  it('returns an uncertain failure if the peer disconnects after DATA and marks the wrapper failed', async () => {
    disconnectAfterData = true;
    const { smtp, logs } = fixture();
    const result = await smtp.sendDeliveryNoteEmail({
      to: 'fixture@example.invalid',
      deliveryNoteNum: 'fixture',
      destination: 'fixture',
      pdfBuffer: Buffer.from('fixture'),
      sentBy: 'fixture',
    });
    expect(result.success).toBe(false);
    expect(logs.completeProcess).toHaveBeenLastCalledWith('fixture', 'FAILED');
  });
});
