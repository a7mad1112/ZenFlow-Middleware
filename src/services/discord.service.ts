import { logger } from '../shared/logger.js';
import { config } from '../config/env.js';

type DiscordDispatchStatus = 'sent_with_attachment' | 'sent_text_only' | 'skipped_no_content';

export interface DiscordDispatchResult {
  status: DiscordDispatchStatus;
  sent: boolean;
  hadAttachment: boolean;
  reason?: string;
}

function resolveDiscordWebhookUrl(overrideUrl?: string): string {
  const finalUrl =
    overrideUrl?.trim() ||
    process.env.DISCORD_WEBHOOK_URL?.trim() ||
    config.discordWebhookUrl?.trim();

  if (!finalUrl || finalUrl === '') {
    throw new Error('Missing Webhook URL');
  }

  return finalUrl;
}

function normalizeSummary(aiSummary: string): string {
  const summary = aiSummary.trim();
  if (!summary || summary.toLowerCase() === 'new order received') {
    return '';
  }

  return summary.length > 1400 ? `${summary.slice(0, 1400)}...` : summary;
}

function buildPayloadSummary(payload?: Record<string, unknown>): string {
  if (!payload || Object.keys(payload).length === 0) {
    return '';
  }

  const eventType = typeof payload.eventType === 'string' ? payload.eventType : null;
  const orderId =
    typeof payload.orderId === 'string'
      ? payload.orderId
      : typeof payload.id === 'string'
        ? payload.id
        : null;

  const customerObj =
    payload.customer && typeof payload.customer === 'object' && !Array.isArray(payload.customer)
      ? (payload.customer as Record<string, unknown>)
      : null;
  const customerName = customerObj && typeof customerObj.name === 'string' ? customerObj.name : null;
  const customerEmail = customerObj && typeof customerObj.email === 'string' ? customerObj.email : null;

  const totalValue = typeof payload.total === 'number' ? payload.total : null;
  const currency = typeof payload.currency === 'string' ? payload.currency : null;

  const lines: string[] = [];
  if (eventType) lines.push(`Event: ${eventType}`);
  if (orderId) lines.push(`Order ID: ${orderId}`);
  if (customerName) lines.push(`Customer: ${customerName}`);
  if (customerEmail) lines.push(`Email: ${customerEmail}`);
  if (totalValue !== null) {
    const totalText = currency ? `${totalValue} ${currency}` : `${totalValue}`;
    lines.push(`Total: ${totalText}`);
  }

  if (lines.length > 0) {
    return lines.join('\n');
  }

  const compact = JSON.stringify(payload);
  if (!compact || compact === '{}' || compact === 'null') {
    return '';
  }

  return compact.length > 1400 ? `${compact.slice(0, 1400)}...` : compact;
}

function buildDiscordContent(
  aiSummary: string,
  payload?: Record<string, unknown>,
  hasXmlAttachment?: boolean
): string {
  const summaryText = normalizeSummary(aiSummary);
  const payloadText = buildPayloadSummary(payload);

  const lines: string[] = [];
  if (summaryText) {
    lines.push('**AI Insight**');
    lines.push(summaryText);
  }

  if (payloadText) {
    if (lines.length > 0) {
      lines.push('');
    }
    lines.push('**Order Summary**');
    lines.push(payloadText);
  }

  if (hasXmlAttachment) {
    if (lines.length > 0) {
      lines.push('');
    }
    lines.push('XML output attached as file: result.xml');
  }

  return lines.join('\n').trim();
}

export async function sendXmlToDiscord(
  xmlContent: string | null | undefined,
  aiSummary: string,
  webhookUrl?: string,
  payload?: Record<string, unknown>
): Promise<DiscordDispatchResult> {
  const url = resolveDiscordWebhookUrl(webhookUrl);
  const xmlText = typeof xmlContent === 'string' ? xmlContent.trim() : '';
  const hasXmlAttachment = xmlText.length > 0;
  const content = buildDiscordContent(aiSummary, payload, hasXmlAttachment);

  if (!content) {
    logger.info('Skipping Discord webhook: no XML and no summary content available');
    return {
      status: 'skipped_no_content',
      sent: false,
      hadAttachment: false,
      reason: 'No XML output and no summary content available',
    };
  }

  let requestBody: FormData | string;
  let requestHeaders: Record<string, string> | undefined;

  if (hasXmlAttachment) {
    const xmlBlob = new Blob([xmlText], { type: 'application/xml' });
    const form = new FormData();
    form.append('payload_json', JSON.stringify({ content }));
    form.append('file', xmlBlob, 'result.xml');
    requestBody = form;
  } else {
    requestBody = JSON.stringify({ content });
    requestHeaders = {
      'Content-Type': 'application/json',
    };
  }

  logger.debug('Sending message to Discord webhook', {
    hasOverrideUrl: Boolean(webhookUrl),
    xmlBytes: hasXmlAttachment ? Buffer.byteLength(xmlText, 'utf-8') : 0,
    mode: hasXmlAttachment ? 'xml_attachment' : 'text_only',
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: requestHeaders,
    body: requestBody,
  });

  if (!response.ok) {
    const body = await response.text();
    const message = `Discord webhook request failed with status ${response.status}`;

    console.error('Discord API error response', {
      status: response.status,
      statusText: response.statusText,
      body,
    });

    logger.error(message, {
      status: response.status,
      responseBody: body,
    });

    throw new Error(message);
  }

  logger.info('Discord webhook message sent successfully', {
    mode: hasXmlAttachment ? 'xml_attachment' : 'text_only',
  });

  return {
    status: hasXmlAttachment ? 'sent_with_attachment' : 'sent_text_only',
    sent: true,
    hadAttachment: hasXmlAttachment,
  };
}
