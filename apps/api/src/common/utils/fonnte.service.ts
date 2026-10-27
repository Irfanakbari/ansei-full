import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FonnteService {
  private readonly logger = new Logger(FonnteService.name);
  private readonly apiUrl = 'https://api.fonnte.com/send';

  constructor(private readonly configService: ConfigService) {}

  async sendWhatsApp(
    target: string,
    message: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    const token = this.configService.get<string>('FONNTE_TOKEN');
    if (!token) {
      this.logger.error('FONNTE_TOKEN is not configured');
      throw new Error('FONNTE_TOKEN is required to send notifications');
    }

    let formattedTarget = target.replace(/\D/g, '');
    if (formattedTarget.startsWith('0')) {
      formattedTarget = '62' + formattedTarget.slice(1);
    } else if (formattedTarget.startsWith('8')) {
      formattedTarget = '62' + formattedTarget;
    }

    try {
      const params = new URLSearchParams();
      params.append('target', formattedTarget);
      params.append('message', message);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        this.logger.error(
          `Fonnte notification HTTP failure status=${response.status}`,
        );
        return { success: false };
      }

      const data = (await response.json()) as { status?: boolean; id?: string };
      if (data.status !== true) {
        this.logger.error('Fonnte notification rejected by provider');
        return { success: false };
      }

      return { success: true, messageId: data.id };
    } catch (error: unknown) {
      this.logger.error(
        `Fonnte notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
