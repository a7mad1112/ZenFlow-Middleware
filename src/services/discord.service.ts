import { logger } from '../shared/logger.js';
import { config } from '../config/env.js';

function resolveDiscordWebhookUrl(): string {
  const url = config.discordWebhookUrl ?? process.env.DISCORD_WEBHOOK_URL;

  if (!url || url.trim() === '') {
    throw new Error('Discord Webhook URL is not configured in .env');
  }

  return url;
}

function buildDiscordPayload(xmlContent: string, aiSummary: string): { content: string } {
  const formattedXml = xmlContent.trim();
  const formattedSummary = aiSummary.trim();

  return {
    content:
      `***AI Insight***\n${formattedSummary}\n\n` +
      `***New Pipeline Result***\n\`\`\`xml\n${formattedXml}\n\`\`\``,
  };
}

export async function sendXmlToDiscord(
  xmlContent: string,
  aiSummary: string
): Promise<void> {
  const url = resolveDiscordWebhookUrl();
  const payload = buildDiscordPayload(xmlContent, aiSummary);

  console.log('Discord URL:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    const message = `Discord webhook request failed with status ${response.status}`;

    logger.error(message, {
      status: response.status,
      responseBody: body,
    });

    throw new Error(message);
  }

  logger.info('Discord webhook message sent successfully');
}
