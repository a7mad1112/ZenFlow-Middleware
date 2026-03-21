import { logger } from '../shared/logger.js';
import { config } from '../config/env.js';

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

function buildDiscordPayload(aiSummary: string): { content: string } {
  const formattedSummary = aiSummary.trim() || 'No AI summary available.';
  const safeSummary = formattedSummary.length > 1400
    ? `${formattedSummary.slice(0, 1400)}...`
    : formattedSummary;

  return {
    content: [
      '**AI Insight**',
      safeSummary,
      '',
      'XML output attached as file: result.xml',
    ].join('\n'),
  };
}

export async function sendXmlToDiscord(
  xmlContent: string,
  aiSummary: string,
  webhookUrl?: string
): Promise<void> {
  const url = resolveDiscordWebhookUrl(webhookUrl);
  const payload = buildDiscordPayload(aiSummary);

  const xmlText = xmlContent.trim();
  const xmlBlob = new Blob([xmlText], { type: 'application/xml' });

  const form = new FormData();
  form.append('payload_json', JSON.stringify(payload));
  form.append('file', xmlBlob, 'result.xml');

  logger.debug('Sending message to Discord webhook', {
    hasOverrideUrl: Boolean(webhookUrl),
    xmlBytes: Buffer.byteLength(xmlText, 'utf-8'),
  });

  const response = await fetch(url, {
    method: 'POST',
    body: form,
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

  logger.info('Discord webhook message sent successfully');
}
