import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuthenticatedPrintAgent {
  id: string;
  credentialId: string;
}

export interface PrintAgentRequest {
  headers: Record<string, string | string[] | undefined>;
  printAgent?: AuthenticatedPrintAgent;
}

type CredentialRow = {
  Id: string;
  AgentId: string;
  SecretHash: string;
  Status: string;
  ExpiresAt: Date | null;
  Agent: { Status: string };
};

type CredentialDelegate = {
  findFirst(input: object): Promise<CredentialRow | null>;
};

@Injectable()
export class PrintAgentAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PrintAgentRequest>();
    const value = request.headers.authorization;
    const authorization = Array.isArray(value) ? value[0] : value;
    if (!authorization?.startsWith('Agent ')) {
      throw new UnauthorizedException('Missing agent credential');
    }
    const secret = authorization.slice(6).trim();
    if (!secret) throw new UnauthorizedException('Invalid agent credential');
    const secretHash = createHash('sha256').update(secret).digest('hex');
    const delegate = (
      this.prisma as unknown as {
        printAgentCredential: CredentialDelegate;
      }
    ).printAgentCredential;
    const credential = await delegate.findFirst({
      where: { SecretHash: secretHash },
      include: { Agent: { select: { Status: true } } },
    });
    const expected = Buffer.from(credential?.SecretHash ?? ''.padEnd(64, '0'));
    const actual = Buffer.from(secretHash);
    const valid =
      credential !== null &&
      expected.length === actual.length &&
      timingSafeEqual(expected, actual) &&
      credential.Status === 'ACTIVE' &&
      credential.Agent.Status === 'ACTIVE' &&
      (!credential.ExpiresAt || credential.ExpiresAt > new Date());
    if (!valid) throw new UnauthorizedException('Invalid agent credential');
    request.printAgent = {
      id: credential.AgentId,
      credentialId: credential.Id,
    };
    return true;
  }
}
