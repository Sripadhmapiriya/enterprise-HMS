import PDFDocument from 'pdfkit';

export interface InvoicePdfData {
  hospitalName?: string;
  billNumber: string;
  billDate?: Date;
  status?: string;
  billType?: string;
  patient?: {
    mrn?: string;
    name?: string;
    gender?: string;
    age?: number;
    phone?: string;
  };
  items?: Array<{
    serviceName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    sourceModule?: string;
  }>;
  subTotal?: number;
  totalTax?: number;
  discountAmount?: number;
  grossTotal?: number;
  paidAmount?: number;
  outstandingAmount?: number;
}

export interface ReceiptPdfData {
  hospitalName?: string;
  receiptNumber: string;
  paymentDate?: Date;
  billNumber?: string;
  patient?: {
    mrn?: string;
    name?: string;
    phone?: string;
  };
  amount: number;
  paymentMethod?: string;
  transactionRef?: string;
  cashierName?: string;
}

export interface LabReportPdfData {
  hospitalName?: string;
  reportId?: string;
  sampleId?: string;
  collectionTime?: Date;
  verifiedTime?: Date;
  patient?: {
    mrn?: string;
    name?: string;
    gender?: string;
    age?: number;
  };
  doctorName?: string;
  specimenType?: string;
  results?: Array<{
    parameterName: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    flag?: string;
  }>;
  verifiedByName?: string;
  criticalNotice?: string;
}

export class PdfService {
  /**
   * Generates a clinical/financial tax invoice PDF
   */
  async generateInvoicePdf(rawData: any): Promise<Buffer> {
    const data: InvoicePdfData = {
      hospitalName: rawData.hospital?.name || rawData.hospitalName || 'Metro Central Diagnostic Hospital',
      billNumber: rawData.billNumber || 'INV-000000',
      billDate: rawData.billDate || rawData.createdAt || new Date(),
      status: rawData.status || 'FINALIZED',
      billType: rawData.billType || 'OPD',
      patient: {
        mrn: rawData.patient?.mrn || 'N/A',
        name: rawData.patient?.name || `${rawData.patient?.firstName || ''} ${rawData.patient?.lastName || ''}`.trim() || 'Patient',
        gender: rawData.patient?.gender || 'N/A',
        phone: rawData.patient?.mobile || rawData.patient?.phone || '',
      },
      items: (rawData.items || []).map((i: any) => ({
        serviceName: i.serviceName || 'Clinical Service',
        quantity: Number(i.quantity) || 1,
        unitPrice: Number(i.unitPrice) || 0,
        lineTotal: Number(i.lineTotal) || (Number(i.quantity) || 1) * (Number(i.unitPrice) || 0),
        sourceModule: i.sourceModule || 'OPD',
      })),
      subTotal: Number(rawData.subTotal) || 0,
      totalTax: Number(rawData.totalTax) || 0,
      discountAmount: Number(rawData.totalDiscount || rawData.discountAmount) || 0,
      grossTotal: Number(rawData.grossTotal) || 0,
      paidAmount: Number(rawData.paidAmount) || 0,
      outstandingAmount: Number(rawData.outstandingAmount ?? (rawData.grossTotal - (rawData.paidAmount || 0))) || 0,
    };

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // 1. Header
      doc.fontSize(18).font('Helvetica-Bold').text(data.hospitalName || 'Hospital', { align: 'left' });
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('TAX INVOICE & BILL OF SUPPLY', { align: 'left' });
      doc.moveDown(0.5);

      // Line
      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(1);

      // 2. Metadata Box
      const topY = doc.y;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text('INVOICE TO:', 40, topY);
      doc.font('Helvetica').text(`Patient: ${data.patient?.name}`);
      doc.text(`MRN: ${data.patient?.mrn} | Gender: ${data.patient?.gender}`);
      if (data.patient?.phone) doc.text(`Phone: ${data.patient?.phone}`);

      doc.fontSize(9).font('Helvetica-Bold').text('INVOICE DETAILS:', 340, topY);
      doc.font('Helvetica').text(`Invoice #: ${data.billNumber}`, 340);
      doc.text(`Date: ${new Date(data.billDate || new Date()).toISOString().slice(0, 10)}`, 340);
      doc.text(`Bill Type: ${data.billType} | Status: ${data.status}`, 340);

      doc.moveDown(2);

      // 3. Line Items Table Header
      const tableTop = Math.max(doc.y, topY + 70);
      doc.rect(40, tableTop, 515, 20).fill('#f1f5f9');
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(9);
      doc.text('Item Description', 48, tableTop + 5);
      doc.text('Module', 240, tableTop + 5);
      doc.text('Qty', 330, tableTop + 5, { width: 30, align: 'right' });
      doc.text('Rate', 380, tableTop + 5, { width: 60, align: 'right' });
      doc.text('Total', 470, tableTop + 5, { width: 75, align: 'right' });

      // Table Rows
      let currentY = tableTop + 24;
      doc.font('Helvetica').fontSize(9).fillColor('#334155');

      for (const item of data.items || []) {
        doc.text(item.serviceName, 48, currentY, { width: 185 });
        doc.text(item.sourceModule || 'OPD', 240, currentY);
        doc.text(item.quantity.toString(), 330, currentY, { width: 30, align: 'right' });
        doc.text(`$${item.unitPrice.toFixed(2)}`, 380, currentY, { width: 60, align: 'right' });
        doc.text(`$${item.lineTotal.toFixed(2)}`, 470, currentY, { width: 75, align: 'right' });

        currentY += 20;
      }

      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, currentY).lineTo(555, currentY).stroke();
      currentY += 10;

      // 4. Totals Summary
      const summaryLeft = 350;
      doc.font('Helvetica').fontSize(9).fillColor('#475569');

      doc.text('Subtotal:', summaryLeft, currentY);
      doc.text(`$${(data.subTotal || 0).toFixed(2)}`, 470, currentY, { width: 75, align: 'right' });
      currentY += 16;

      if (data.discountAmount) {
        doc.text('Total Discount:', summaryLeft, currentY);
        doc.text(`-$${data.discountAmount.toFixed(2)}`, 470, currentY, { width: 75, align: 'right' });
        currentY += 16;
      }

      if (data.totalTax) {
        doc.text('Taxes / GST:', summaryLeft, currentY);
        doc.text(`+$${data.totalTax.toFixed(2)}`, 470, currentY, { width: 75, align: 'right' });
        currentY += 16;
      }

      doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(summaryLeft, currentY).lineTo(555, currentY).stroke();
      currentY += 6;

      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a');
      doc.text('Gross Total:', summaryLeft, currentY);
      doc.text(`$${(data.grossTotal || 0).toFixed(2)}`, 470, currentY, { width: 75, align: 'right' });
      currentY += 18;

      doc.font('Helvetica').fontSize(9).fillColor('#047857');
      doc.text('Amount Paid:', summaryLeft, currentY);
      doc.text(`$${(data.paidAmount || 0).toFixed(2)}`, 470, currentY, { width: 75, align: 'right' });
      currentY += 16;

      doc.font('Helvetica-Bold').fontSize(10).fillColor((data.outstandingAmount || 0) > 0 ? '#b91c1c' : '#047857');
      doc.text('Balance Due:', summaryLeft, currentY);
      doc.text(`$${(data.outstandingAmount || 0).toFixed(2)}`, 470, currentY, { width: 75, align: 'right' });

      // 5. Footer & Terms
      doc.fontSize(8).fillColor('#94a3b8').text('This is an electronically generated tax invoice requiring no physical signature.', 40, 780, {
        align: 'center',
        width: 515,
      });

      doc.end();
    });
  }

  /**
   * Generates a patient payment receipt PDF
   */
  async generateReceiptPdf(rawData: any): Promise<Buffer> {
    const data: ReceiptPdfData = {
      hospitalName: rawData.bill?.hospital?.name || rawData.hospitalName || 'Metro Central Diagnostic Hospital',
      receiptNumber: rawData.receiptNumber || 'RCPT-000000',
      paymentDate: rawData.paymentDate || rawData.createdAt || new Date(),
      billNumber: rawData.bill?.billNumber || rawData.billNumber || 'N/A',
      patient: {
        mrn: rawData.patient?.mrn || 'N/A',
        name: rawData.patient?.name || `${rawData.patient?.firstName || ''} ${rawData.patient?.lastName || ''}`.trim() || 'Patient',
        phone: rawData.patient?.mobile || '',
      },
      amount: Number(rawData.amount) || 0,
      paymentMethod: rawData.paymentMethod || 'CASH',
      transactionRef: rawData.transactionRef || '',
      cashierName: rawData.receivedBy ? `${rawData.receivedBy.firstName} ${rawData.receivedBy.lastName}` : 'Cashier Desk',
    };

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A5', layout: 'portrait' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Header
      doc.fontSize(15).font('Helvetica-Bold').text(data.hospitalName || 'Hospital', { align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('OFFICIAL PAYMENT RECEIPT', { align: 'center' });
      doc.moveDown(0.5);

      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(380, doc.y).stroke();
      doc.moveDown(0.8);

      // Receipt Box
      const startY = doc.y;
      doc.rect(40, startY, 340, 160).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

      let rowY = startY + 12;
      const leftCol = 55;
      const rightCol = 220;

      doc.fontSize(8.5).fillColor('#475569');

      doc.text('Receipt Number:', leftCol, rowY);
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(data.receiptNumber, rightCol, rowY);
      doc.font('Helvetica').fillColor('#475569');

      rowY += 18;
      doc.text('Payment Date:', leftCol, rowY);
      doc.text(new Date(data.paymentDate || new Date()).toLocaleString(), rightCol, rowY);

      rowY += 18;
      doc.text('Patient Name:', leftCol, rowY);
      doc.font('Helvetica-Bold').text(data.patient?.name || 'Patient', rightCol, rowY);
      doc.font('Helvetica');

      rowY += 18;
      doc.text('Patient MRN:', leftCol, rowY);
      doc.text(data.patient?.mrn || 'N/A', rightCol, rowY);

      rowY += 18;
      doc.text('Against Invoice #:', leftCol, rowY);
      doc.text(data.billNumber || 'Direct Settlement', rightCol, rowY);

      rowY += 18;
      doc.text('Payment Mode:', leftCol, rowY);
      doc.text(data.paymentMethod + (data.transactionRef ? ` (${data.transactionRef})` : ''), rightCol, rowY);

      rowY += 24;
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(45, rowY).lineTo(375, rowY).stroke();

      rowY += 10;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#047857');
      doc.text('AMOUNT RECEIVED:', leftCol, rowY);
      doc.text(`$${data.amount.toFixed(2)}`, rightCol, rowY);

      // Sign-off
      doc.fontSize(8).fillColor('#64748b').text(`Received by: ${data.cashierName || 'Cashier Desk'}`, 55, startY + 180);
      doc.text('Thank you for choosing our healthcare services.', 40, startY + 220, { align: 'center', width: 340 });

      doc.end();
    });
  }

  /**
   * Generates a standardized clinical laboratory test report PDF
   */
  async generateLabReportPdf(rawSample: any, rawHospital?: any): Promise<Buffer> {
    const patientObj = rawSample.orderItem?.order?.patient || rawSample.patient || {};
    const doctorObj = rawSample.orderItem?.order?.doctor?.user || rawSample.doctor || {};
    const pathologistObj = rawSample.pathologist || rawSample.verifiedBy || {};

    const data: LabReportPdfData = {
      hospitalName: rawHospital?.name || 'Metro Central Diagnostic Hospital',
      reportId: rawSample.id || 'REP-001',
      sampleId: rawSample.sampleId || rawSample.sampleNumber || 'LAB-001',
      collectionTime: rawSample.collectionTime || rawSample.createdAt || new Date(),
      verifiedTime: rawSample.validatedAt || rawSample.updatedAt || new Date(),
      patient: {
        mrn: patientObj.mrn || 'N/A',
        name: patientObj.name || `${patientObj.firstName || ''} ${patientObj.lastName || ''}`.trim() || 'Patient',
        gender: patientObj.gender || 'N/A',
      },
      doctorName: `${doctorObj.firstName || ''} ${doctorObj.lastName || ''}`.trim() || undefined,
      specimenType: rawSample.specimenType?.name || rawSample.specimenType || 'Specimen',
      results: (rawSample.results || []).map((r: any) => ({
        parameterName: r.parameterName || r.parameter || 'Analyte',
        value: String(r.value ?? r.numericValue ?? ''),
        unit: r.unit || '',
        referenceRange: r.referenceRange || '',
        flag: r.flag || 'NORMAL',
      })),
      verifiedByName: `${pathologistObj.firstName || 'Pathologist'} ${pathologistObj.lastName || ''}`.trim(),
      criticalNotice: (rawSample.results || []).some((r: any) => r.flag === 'CRITICAL' || r.isCritical)
        ? 'Values exceed panic safety thresholds. Attending physician notified.'
        : undefined,
    };

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Header
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a').text(data.hospitalName || 'Hospital', { align: 'left' });
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('DEPARTMENT OF CLINICAL PATHOLOGY & LABORATORY MEDICINE', { align: 'left' });
      doc.moveDown(0.5);

      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.8);

      // Patient & Specimen Info Banner
      const infoY = doc.y;
      doc.rect(40, infoY, 515, 55).fill('#f8fafc');

      doc.fontSize(8.5).font('Helvetica').fillColor('#334155');
      doc.text(`Patient: ${data.patient?.name}`, 50, infoY + 8);
      doc.text(`MRN: ${data.patient?.mrn}`, 50, infoY + 22);
      doc.text(`Gender: ${data.patient?.gender}`, 50, infoY + 36);

      const collDateStr = new Date(data.collectionTime || new Date()).toISOString().slice(0, 16).replace('T', ' ');
      const verDateStr = new Date(data.verifiedTime || new Date()).toISOString().slice(0, 16).replace('T', ' ');

      doc.text(`Sample ID: ${data.sampleId}`, 230, infoY + 8);
      doc.text(`Specimen: ${data.specimenType}`, 230, infoY + 22);
      doc.text(`Collected: ${collDateStr}`, 230, infoY + 36);

      doc.text(`Report ID: ${data.reportId}`, 400, infoY + 8);
      doc.text(`Verified: ${verDateStr}`, 400, infoY + 22);
      if (data.doctorName) doc.text(`Ref Doctor: Dr. ${data.doctorName}`, 400, infoY + 36);

      doc.moveDown(3);

      // Critical Alert Box if applicable
      if (data.criticalNotice) {
        const alertY = doc.y;
        doc.rect(40, alertY, 515, 24).fill('#fee2e2');
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#991b1b').text(`CRITICAL ALERT: ${data.criticalNotice}`, 50, alertY + 7);
        doc.moveDown(1.5);
      }

      // Results Table Header
      const tableY = doc.y;
      doc.rect(40, tableY, 515, 20).fill('#e2e8f0');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b');
      doc.text('Test Parameter', 50, tableY + 5);
      doc.text('Observed Value', 240, tableY + 5);
      doc.text('Unit', 340, tableY + 5);
      doc.text('Biological Reference Interval', 410, tableY + 5);

      // Results Rows
      let rowY = tableY + 25;
      for (const res of data.results || []) {
        const isAbnormal = res.flag && res.flag !== 'NORMAL';
        doc.font(isAbnormal ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        doc.fillColor(isAbnormal ? '#b91c1c' : '#1e293b');

        doc.text(res.parameterName, 50, rowY, { width: 180 });
        doc.text(res.value + (isAbnormal ? ` (${res.flag})` : ''), 240, rowY);
        doc.fillColor('#475569').font('Helvetica');
        doc.text(res.unit || '', 340, rowY);
        doc.text(res.referenceRange || '', 410, rowY);

        rowY += 22;
      }

      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, rowY).lineTo(555, rowY).stroke();

      // Signature & Validation Block
      const sigY = 700;
      doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(400, sigY).lineTo(540, sigY).stroke();
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text(data.verifiedByName || 'Consultant Pathologist', 400, sigY + 5);
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text('Authorized Signatory / Lab Director', 400, sigY + 16);

      doc.fontSize(7.5).fillColor('#94a3b8').text('End of laboratory report. Clinically correlate results with patient symptoms.', 40, 780, {
        align: 'center',
        width: 515,
      });

      doc.end();
    });
  }
}

export const pdfService = new PdfService();
