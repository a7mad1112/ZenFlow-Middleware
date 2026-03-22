import { Builder } from 'xml2js';
import { logger } from './logger.js';

/**
 * Convert JSON object to XML string
 * @param jsonObject - The JSON object to convert
 * @param rootElementName - The root element name (default: 'root')
 * @returns XML string
 */
export function jsonToXml(
  jsonObject: Record<string, unknown>,
  rootElementName: string = 'root'
): string {
  try {
    const builder = new Builder({
      rootName: rootElementName,
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      cdata: true,
    });

    const xml = builder.buildObject(jsonObject);

    logger.debug('JSON converted to XML successfully', {
      rootElement: rootElementName,
      xmlLength: xml.length,
    });

    return xml;
  } catch (error) {
    logger.error('Failed to convert JSON to XML', {
      error: error instanceof Error ? error.message : String(error),
      rootElement: rootElementName,
    });
    throw error;
  }
}

/**
 * Validate JSON object structure
 * @param jsonObject - The JSON object to validate
 * @returns boolean indicating if the object is valid
 */
export function isValidJsonForXml(jsonObject: unknown): boolean {
  if (typeof jsonObject !== 'object' || jsonObject === null) {
    return false;
  }

  if (Array.isArray(jsonObject)) {
    return false;
  }

  return true;
}

/**
 * Sanitize XML element names from JSON keys
 * Ensures keys are valid XML element names
 * @param key - The key to sanitize
 * @returns Sanitized key safe for XML
 */
export function sanitizeXmlKey(key: string): string {
  // Remove invalid XML characters and replace with underscores
  return key
    .replace(/[^a-zA-Z0-9_:-]/g, '_')
    .replace(/^[0-9-]/, '_$&') // XML element names must not start with numbers or hyphens
    .substring(0, 1024); // Limit length
}

/**
 * Deep sanitize object keys for XML compatibility
 * @param obj - The object to sanitize
 * @returns Object with sanitized keys
 */
export function sanitizeObjectForXml(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeXmlKey(key);

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[sanitizedKey] = sanitizeObjectForXml(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[sanitizedKey] = value.map((item) => {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          return sanitizeObjectForXml(item as Record<string, unknown>);
        }
        return item;
      });
    } else {
      sanitized[sanitizedKey] = value;
    }
  }

  return sanitized;
}

/**
 * Transform payload using specified transformer
 * Currently supports: json-to-xml
 * @param payload - Input payload
 * @param transformType - Type of transformation
 * @param options - Options for the transformation
 * @returns Transformed payload
 */
export function transformPayload(
  payload: Record<string, unknown>,
  transformType: string = 'json-to-xml',
  options?: Record<string, unknown>
): string {
  switch (transformType.toLowerCase()) {
    case 'json-to-xml': {
      const rootElement = options?.rootElement || 'data';
      const sanitized = sanitizeObjectForXml(payload);
      return jsonToXml(sanitized, String(rootElement));
    }

    default:
      throw new Error(`Unknown transformation type: ${transformType}`);
  }
}
