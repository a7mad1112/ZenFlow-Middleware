import { describe, expect, it } from '@jest/globals';
import { jsonToXml } from '../../src/shared/transformers.js';

describe('XML Service', () => {
  it('generates valid XML from JSON payload', () => {
    const payload = {
      orderId: 'ORD-1001',
      customer: { name: 'Alice' },
      total: 149.99,
    };

    const xml = jsonToXml(payload, 'order');

    expect(typeof xml).toBe('string');
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<order>');
    expect(xml).toContain('<orderId>ORD-1001</orderId>');
    expect(xml).toContain('<name>Alice</name>');
    expect(xml).toContain('<total>149.99</total>');
  });
});
