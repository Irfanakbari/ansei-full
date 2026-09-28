import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'node:net';
import { access } from 'node:fs/promises';
import { PrismaService } from '../prisma/prisma.service';

export type DependencyStatus = 'up' | 'down' | 'disabled' | 'degraded';

export interface ReadinessResult {
  status: 'ready' | 'not_ready';
  checks: Record<string, { status: DependencyStatus; required: boolean }>;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  liveness(): { status: 'alive' } {
    return { status: 'alive' };
  }

  async readiness(): Promise<ReadinessResult> {
    const databaseUp = await this.checkDatabase();
    const redisRequired = this.boolean('REDIS_REQUIRED', true);
    const redisUp = await this.checkTcp(
      'REDIS_HOST',
      'REDIS_PORT',
      6379,
      redisRequired,
    );
    const checks: ReadinessResult['checks'] = {
      database: { status: databaseUp ? 'up' : 'down', required: true },
      redis: { status: redisUp, required: redisRequired },
      sso: await this.optionalTcp('VUTEQ_SSO_ENABLED', 'VUTEQ_SSO_BASE_URL'),
      nas: await this.optionalTcp('NAS_ENABLED', 'NAS_HOST', 'NAS_PORT'),
      smtp: await this.optionalTcp('SMTP_ENABLED', 'SMTP_HOST', 'SMTP_PORT'),
      converter: await this.converterStatus(),
    };
    const requiredUp = databaseUp && (!redisRequired || redisUp === 'up');
    return { status: requiredUp ? 'ready' : 'not_ready', checks };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private async optionalTcp(
    flag: string,
    hostName: string,
    portName?: string,
  ): Promise<{ status: DependencyStatus; required: false }> {
    if (!this.boolean(flag, false))
      return { status: 'disabled', required: false };
    if (hostName.endsWith('_URL')) {
      try {
        const target = new URL(this.config.get<string>(hostName) ?? '');
        return {
          status: (await this.connect(
            target.hostname,
            Number(target.port || (target.protocol === 'https:' ? 443 : 80)),
          ))
            ? 'up'
            : 'degraded',
          required: false,
        };
      } catch {
        return { status: 'degraded', required: false };
      }
    }
    const status = await this.checkTcp(
      hostName,
      portName ?? '',
      undefined,
      true,
    );
    return { status: status === 'up' ? 'up' : 'degraded', required: false };
  }

  private async checkTcp(
    hostName: string,
    portName: string,
    fallback: number | undefined,
    enabled: boolean,
  ): Promise<DependencyStatus> {
    if (!enabled) return 'disabled';
    const host = this.config.get<string>(hostName);
    const port = Number(this.config.get<string>(portName) ?? fallback);
    if (!host || !Number.isInteger(port)) return 'down';
    return (await this.connect(host, port)) ? 'up' : 'down';
  }

  private connect(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new Socket();
      const finish = (result: boolean) => {
        socket.destroy();
        resolve(result);
      };
      socket.setTimeout(1500);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
      socket.connect(port, host);
    });
  }

  private configured(
    flag: string,
    requiredNames: string[],
  ): { status: DependencyStatus; required: false } {
    if (!this.boolean(flag, false))
      return { status: 'disabled', required: false };
    return {
      status: requiredNames.every((name) =>
        Boolean(this.config.get<string>(name)),
      )
        ? 'up'
        : 'degraded',
      required: false,
    };
  }

  private async converterStatus(): Promise<{
    status: DependencyStatus;
    required: false;
  }> {
    if (!this.boolean('DOCUMENT_CONVERTER_ENABLED', true))
      return { status: 'disabled', required: false };
    const path =
      this.config.get<string>('LIBREOFFICE_PATH') ??
      this.config.get<string>('WASM_PATH');
    if (!path) return { status: 'degraded', required: false };
    try {
      await access(path);
      return { status: 'up', required: false };
    } catch {
      return { status: 'degraded', required: false };
    }
  }

  private boolean(name: string, fallback: boolean): boolean {
    const value = this.config.get<string>(name);
    return value === undefined
      ? fallback
      : ['true', '1'].includes(value.toLowerCase());
  }
}
