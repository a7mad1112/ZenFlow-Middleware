import PDFDocument from 'pdfkit';

function resolveCustomerName(payload: any): string {
  return payload?.customer?.name ?? payload?.customerName ?? 'Valued Customer';
}

function resolveOrderId(payload: any): string {
  return String(payload?.orderId ?? payload?.id ?? 'N/A');
}

function resolveTotalAmount(payload: any): string {
  const total = payload?.total ?? payload?.amount ?? 0;
  const currency = payload?.currency ?? 'USD';
  const numericTotal = typeof total === 'number' ? total : Number(total);
  const safeTotal = Number.isFinite(numericTotal) ? numericTotal : 0;

  return `${safeTotal.toFixed(2)} ${currency}`;
}

export async function generateInvoice(payload: any): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const orderId = resolveOrderId(payload);
    const customerName = resolveCustomerName(payload);
    const totalAmount = resolveTotalAmount(payload);
    const issuedDate = new Date().toISOString().slice(0, 10);

    doc.fontSize(28).font('Helvetica-Bold').text('INVOICE', { align: 'left' });
    doc.moveDown(0.5);

    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#4b5563')
      .text(`Date: ${issuedDate}`)
      .text(`Order ID: ${orderId}`)
      .fillColor('#000000');

    doc.moveDown(1.5);

    const tableTop = doc.y;
    const labelX = 60;
    const valueX = 220;

    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Summary', labelX, tableTop)
      .moveDown(0.8);

    const rows = [
      { label: 'Customer Name', value: customerName },
      { label: 'Total Amount', value: totalAmount },
    ];

    let y = doc.y;
    for (const row of rows) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(row.label, labelX, y)
        .font('Helvetica')
        .text(row.value, valueX, y);

      y += 24;
      doc
        .strokeColor('#d1d5db')
        .lineWidth(1)
        .moveTo(labelX, y - 6)
        .lineTo(540, y - 6)
        .stroke();
    }

    doc.moveDown(3);
    doc
      .fontSize(10)
      .fillColor('#6b7280')
      .text('Thank you for your business.', 60, y + 20)
      .fillColor('#000000');

    doc.end();
  });
}
