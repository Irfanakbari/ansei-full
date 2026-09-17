import {
  Controller,
  Get,
  Headers,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../auth/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return this.health.liveness();
  }

  @Public()
  @Get('ready')
  @ApiExcludeEndpoint()
  async ready(
    @Headers('x-health-token') token: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.authorize(token);
    const result = await this.health.readiness();
    response.status(result.status === 'ready' ? 200 : 503);
    return result;
  }

  private authorize(token?: string): void {
    if (this.config.get<string>('HEALTH_READINESS_PROTECTED') !== 'true')
      return;
    const expected = this.config.get<string>('HEALTH_READINESS_TOKEN') ?? '';
    const actual = token ?? '';
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);
    if (
      expectedBuffer.length !== actualBuffer.length ||
      !timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      throw new UnauthorizedException('Readiness probe authentication failed');
    }
  }
}
