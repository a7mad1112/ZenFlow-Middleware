import { describe, expect, it } from '@jest/globals';
import { generateInvoice } from '../../src/services/pdf.service.js';

describe('PDF Service', () => {
  it('returns a PDF payload as a string-compatible buffer', async () => {
    const pdfBuffer = await generateInvoice({
      orderId: 'INV-1001',
      customer: { name: 'QA User' },
      total: 99.5,
      currency: 'USD',
    });

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(100);
    expect(pdfBuffer.toString('utf8', 0, 5)).toBe('%PDF-');
  });
});
