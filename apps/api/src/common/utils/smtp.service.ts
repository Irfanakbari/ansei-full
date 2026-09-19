import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { LogProcessService } from '../log-process/log-process.service';
import type { LogProcessModel } from '../../generated/prisma/models';

export interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName?: string;
}

@Injectable()
export class SmtpService {
  private readonly logger = new Logger(SmtpService.name);
  private transporter: Transporter;
  private config: SmtpConfig;

  constructor(private readonly logService: LogProcessService) {
    this.config = {
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
      fromName: process.env.SMTP_FROM_NAME || 'ANSEI System',
    };

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
      tls: {
        ciphers: 'SSLv3',
      },
    });

    this.logger.log(
      `SMTP Service initialized with host: ${this.config.host}:${this.config.port}`,
    );
  }

  /**
   * Send email with optional attachments
   */
  async sendEmail(
    options: SendEmailOptions,
    createdBy?: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'SMTP_001',
        functionName: 'SmtpService.SendEmail',
        createdBy,
      });

      const toAddresses = Array.isArray(options.to)
        ? options.to
        : options.to.split(',').map((email) => email.trim());

      const ccAddresses = options.cc
        ? Array.isArray(options.cc)
          ? options.cc
          : options.cc.split(',').map((email) => email.trim())
        : undefined;

      const bccAddresses = options.bcc
        ? Array.isArray(options.bcc)
          ? options.bcc
          : options.bcc.split(',').map((email) => email.trim())
        : undefined;

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: 'Submitting email to configured recipients.',
        type: 'INFO',
        location: 'smtp.service.ts:82',
      });

      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${this.config.fromName}" <${this.config.from}>`,
        to: toAddresses.join(', '),
        cc: ccAddresses ? ccAddresses.join(', ') : undefined,
        bcc: bccAddresses ? bccAddresses.join(', ') : undefined,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        })),
      };

      const info = await this.transporter.sendMail(mailOptions);

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: 'Email accepted by transport.',
        type: 'INFO',
        location: 'smtp.service.ts:101',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch {
      const errorMessage =
        'Email operation failed; inspect transport configuration and delivery evidence.';

      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Failed to send email: ${errorMessage}`,
          type: 'ERROR',
          location: 'smtp.service.ts:113',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }

      this.logger.error(errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send Delivery Note email with PDF attachment
   */
  async sendDeliveryNoteEmail(params: {
    to: string | string[];
    cc?: string | string[];
    deliveryNoteNum: string;
    destination: string;
    pdfBuffer: Buffer;
    sentBy: string;
    subject?: string;
    message?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'SMTP_002',
        functionName: 'SmtpService.SendDeliveryNoteEmail',
        createdBy: params.sentBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: 'Preparing delivery note email.',
        type: 'INFO',
        location: 'smtp.service.ts:143',
      });

      const escapeHtml = (value: string) =>
        value.replace(
          /[&<>"']/g,
          (character) =>
            ({
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;',
              '"': '&quot;',
              "'": '&#39;',
            })[character]!,
        );
      const subject =
        params.subject || `Delivery Note - ${params.deliveryNoteNum}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Delivery Note</h2>
          <p>Dear Team,</p>
          <p>Please find attached the Delivery Note <strong>${escapeHtml(params.deliveryNoteNum)}</strong> for destination: <strong>${escapeHtml(params.destination)}</strong>.</p>
          ${params.message ? `<p>${escapeHtml(params.message)}</p>` : ''}
          <p>Please confirm receipt once the materials have been received.</p>
          <br/>
          <p>Best regards,<br/>ANSEI System</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
          <p style="font-size: 12px; color: #666;">
            This is an automated email from ANSEI Production System.<br/>
            Do not reply directly to this email.
          </p>
        </div>
      `;

      const result = await this.sendEmail(
        {
          to: params.to,
          cc: params.cc,
          subject,
          html,
          attachments: [
            {
              filename: `DN_${params.deliveryNoteNum.replace(/\//g, '-')}.pdf`,
              content: params.pdfBuffer,
              contentType: 'application/pdf',
            },
          ],
        },
        params.sentBy,
      );

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Delivery Note email result: success=${result.success}`,
        type: 'INFO',
        location: 'smtp.service.ts:175',
      });

      await this.logService.completeProcess(
        logProcess.ProcessId,
        result.success ? 'SUCCESS' : 'FAILED',
      );

      return result;
    } catch {
      const errorMessage =
        'Email operation failed; inspect transport configuration and delivery evidence.';

      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `Failed to send Delivery Note email: ${errorMessage}`,
          type: 'ERROR',
          location: 'smtp.service.ts:185',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully');
      return true;
    } catch {
      this.logger.error(
        `SMTP connection verification failed: ${'Email operation failed; inspect transport configuration and delivery evidence.'}`,
      );
      return false;
    }
  }
}
