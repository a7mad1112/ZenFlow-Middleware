import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config/env.js';
import { logger } from '../shared/logger.js';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function resolveCustomerName(payload: any): string {
  return payload?.customer?.name ?? payload?.customerName ?? 'Valued Customer';
}

function resolveAmount(payload: any): string {
  const total = payload?.total ?? payload?.amount ?? 0;
  const currency = payload?.currency ?? 'USD';

  const numericTotal = typeof total === 'number' ? total : Number(total);
  const safeTotal = Number.isFinite(numericTotal) ? numericTotal : 0;

  return `${safeTotal.toFixed(2)} ${currency}`;
}

function buildOrderConfirmationTemplate(payload: any): string {
  const orderId = escapeHtml(payload?.orderId ?? payload?.id ?? 'N/A');
  const customerName = escapeHtml(resolveCustomerName(payload));
  const amount = escapeHtml(resolveAmount(payload));

  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5; max-width: 720px; margin: 0 auto;">
      <h2 style="margin-bottom: 8px;">Order Confirmation</h2>
      <p style="margin-top: 0; color: #4b5563;">Your order has been received and processed successfully.</p>

      <table style="width: 100%; border-collapse: collapse; margin-top: 16px; border: 1px solid #e5e7eb;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="text-align: left; border: 1px solid #e5e7eb; padding: 12px;">Field</th>
            <th style="text-align: left; border: 1px solid #e5e7eb; padding: 12px;">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 12px;">Order ID</td>
            <td style="border: 1px solid #e5e7eb; padding: 12px;">${orderId}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 12px;">Customer Name</td>
            <td style="border: 1px solid #e5e7eb; padding: 12px;">${customerName}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e5e7eb; padding: 12px;">Total Amount</td>
            <td style="border: 1px solid #e5e7eb; padding: 12px;">${amount}</td>
          </tr>
        </tbody>
      </table>

      <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">Thank you for your purchase.</p>
    </div>
  `;
}

interface SendOrderConfirmationOptions {
  attachment?: Buffer;
  aiSummary?: string;
  smtpConfig?: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
    from?: string;
  };
}

class EmailService {
  private transporterInstance: Transporter | null = null;

  private getTransporter(smtpConfig?: SendOrderConfirmationOptions['smtpConfig']): Transporter {
    if (!smtpConfig && this.transporterInstance) {
      return this.transporterInstance;
    }

    const user = smtpConfig?.user ?? config.smtpUser;
    const pass = smtpConfig?.pass ?? config.smtpPass;

    if (!user || !pass) {
      throw new Error('SMTP credentials are not configured. Set SMTP_USER and SMTP_PASS in .env');
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig?.host ?? config.smtpHost,
      port: smtpConfig?.port ?? config.smtpPort,
      secure: smtpConfig?.secure ?? config.smtpSecure,
      auth: {
        user,
        pass,
      },
    });

    if (!smtpConfig) {
      this.transporterInstance = transporter;
    }

    return transporter;
  }

  async sendOrderConfirmation(
    to: string,
    payload: any,
    options?: SendOrderConfirmationOptions
  ): Promise<void> {
    const transporter = this.getTransporter(options?.smtpConfig);
    const from =
      options?.smtpConfig?.from || config.emailFrom || options?.smtpConfig?.user || config.smtpUser;

    if (!from) {
      throw new Error('Email sender is not configured. Set EMAIL_FROM or SMTP_USER in .env');
    }

    const subject = `Order Confirmation${payload?.orderId ? ` #${payload.orderId}` : ''}`;
    const html = buildOrderConfirmationTemplate(payload);
    const aiSummaryHtml = options?.aiSummary
      ? `<p style="margin-top: 0; color: #111827;"><strong>AI Insight:</strong> ${escapeHtml(options.aiSummary)}</p>`
      : '';

    await transporter.sendMail({
      from,
      to,
      subject,
      html: `
        <div>
          ${aiSummaryHtml}
          ${html}
        </div>
      `,
      attachments: options?.attachment
        ? [
            {
              filename: 'invoice.pdf',
              content: options.attachment,
            },
          ]
        : undefined,
    });

    logger.info('Order confirmation email sent successfully', {
      to,
      orderId: payload?.orderId ?? payload?.id,
    });
  }

  async verifyConnection(): Promise<void> {
    const transporter = this.getTransporter();
    await transporter.verify();
  }
}

export const emailService = new EmailService();
