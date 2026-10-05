import PDFDocument from 'pdfkit';

export type PdfTemplateType =
  | 'invoice'
  | 'receipt'
  | 'prescription'
  | 'lab_report'
  | 'radiology_report'
  | 'discharge_summary'
  | 'wristband'
  | 'barcode_label';

export interface PdfGenerationOptions {
  template: PdfTemplateType;
  hospitalName?: string;
  hospitalAddress?: string;
  data: Record<string, any>;
}

export class PdfEngine {
  /**
   * Generates a complete PDF document buffer for the requested template.
   */
  async generatePdf(options: PdfGenerationOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: options.template === 'wristband' || options.template === 'barcode_label' ? [300, 150] : 'A4',
        margin: 40,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const hospital = options.hospitalName || 'City General Hospital';
      const address = options.hospitalAddress || '100 Medical Center Blvd, Metro City';

      switch (options.template) {
        case 'invoice':
          this.renderInvoice(doc, hospital, address, options.data);
          break;
        case 'receipt':
          this.renderReceipt(doc, hospital, address, options.data);
          break;
        case 'prescription':
          this.renderPrescription(doc, hospital, address, options.data);
          break;
        case 'lab_report':
          this.renderLabReport(doc, hospital, address, options.data);
          break;
        case 'radiology_report':
          this.renderRadiologyReport(doc, hospital, address, options.data);
          break;
        case 'discharge_summary':
          this.renderDischargeSummary(doc, hospital, address, options.data);
          break;
        case 'wristband':
          this.renderWristband(doc, hospital, options.data);
          break;
        case 'barcode_label':
          this.renderBarcodeLabel(doc, hospital, options.data);
          break;
        default:
          this.renderGenericDocument(doc, hospital, options.data);
      }

      doc.end();
    });
  }

  private renderHeader(doc: PDFKit.PDFDocument, hospital: string, address: string, title: string) {
    doc.fontSize(18).font('Helvetica-Bold').text(hospital, { align: 'center' });
    doc.fontSize(9).font('Helvetica').text(address, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text(title.toUpperCase(), { align: 'center' });
    doc.moveTo(40, doc.y + 5).lineTo(555, doc.y + 5).strokeColor('#cbd5e1').stroke();
    doc.moveDown(1);
  }

  private renderInvoice(doc: PDFKit.PDFDocument, hospital: string, address: string, data: any) {
    this.renderHeader(doc, hospital, address, 'Tax Invoice');

    // Patient & Bill Meta
    doc.fontSize(10).font('Helvetica-Bold').text(`Invoice #: ${data.invoiceNumber || 'INV-2026-001'}`);
    doc.font('Helvetica').text(`Date: ${data.date || new Date().toISOString().split('T')[0]}`);
    doc.text(`Patient: ${data.patientName || 'Jane Doe'} (MRN: ${data.mrn || 'MRN-1001'})`);
    doc.moveDown(1);

    // Items table header
    const tableTop = doc.y;
    doc.font('Helvetica-Bold');
    doc.text('Description', 40, tableTop);
    doc.text('Qty', 350, tableTop);
    doc.text('Rate', 420, tableTop);
    doc.text('Amount ($)', 480, tableTop, { align: 'right' });
    doc.moveTo(40, doc.y + 2).lineTo(555, doc.y + 2).strokeColor('#e2e8f0').stroke();
    doc.font('Helvetica');

    let curY = doc.y + 6;
    const items = data.items || [
      { description: 'OPD Specialist Consultation', quantity: 1, rate: 150, amount: 150 },
      { description: 'Complete Blood Count (CBC)', quantity: 1, rate: 45, amount: 45 },
    ];

    items.forEach((item: any) => {
      doc.text(item.description, 40, curY);
      doc.text(String(item.quantity), 350, curY);
      doc.text(`$${item.rate}`, 420, curY);
      doc.text(`$${item.amount}`, 480, curY, { align: 'right' });
      curY += 18;
    });

    doc.moveTo(40, curY).lineTo(555, curY).strokeColor('#cbd5e1').stroke();
    curY += 8;

    doc.font('Helvetica-Bold');
    doc.text(`Total Amount: $${data.totalAmount || 195}`, 350, curY, { align: 'right' });
    curY += 15;
    doc.text(`Payments Made: $${data.paidAmount || 195}`, 350, curY, { align: 'right' });
    curY += 15;
    doc.text(`Balance Due: $${data.balanceDue || 0}`, 350, curY, { align: 'right' });

    doc.moveDown(3);
    doc.fontSize(8).font('Helvetica-Oblique').text('Thank you for choosing our healthcare facility. This is a computer generated document.', { align: 'center' });
  }

  private renderReceipt(doc: PDFKit.PDFDocument, hospital: string, address: string, data: any) {
    this.renderHeader(doc, hospital, address, 'Payment Receipt');

    doc.fontSize(10).font('Helvetica-Bold').text(`Receipt Number: ${data.receiptNumber || 'REC-2026-001'}`);
    doc.font('Helvetica').text(`Transaction Date: ${data.date || new Date().toISOString()}`);
    doc.text(`Received From: ${data.patientName || 'Jane Doe'} (MRN: ${data.mrn || 'MRN-1001'})`);
    doc.text(`Payment Mode: ${data.paymentMode || 'CASH'}`);
    doc.text(`Reference / Transaction ID: ${data.transactionRef || 'TXN-998234'}`);
    doc.moveDown(1);

    doc.fontSize(14).font('Helvetica-Bold').text(`Amount Paid: $${data.amount || '150.00'}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(9).font('Helvetica').text('Cashier Signature: _________________________', { align: 'right' });
  }

  private renderPrescription(doc: PDFKit.PDFDocument, hospital: string, address: string, data: any) {
    this.renderHeader(doc, hospital, address, 'Medical Prescription (Rx)');

    doc.fontSize(10).font('Helvetica-Bold').text(`Doctor: Dr. ${data.doctorName || 'Sarah Connor'}, MD`);
    doc.font('Helvetica').text(`Patient: ${data.patientName || 'Jane Doe'} | Age/Sex: ${data.age || '32'}Y / ${data.gender || 'F'}`);
    doc.text(`MRN: ${data.mrn || 'MRN-1001'} | Encounter: ${data.encounterId || 'ENC-9002'}`);
    doc.text(`Known Allergies: ${data.allergies || 'Penicillin (Severe)'}`);
    doc.moveDown(1);

    doc.fontSize(14).font('Helvetica-Bold').text('Rx Medications:');
    doc.moveDown(0.5);

    const meds = data.medications || [
      { name: 'Amoxicillin 500mg', dosage: '1 Capsule', frequency: 'TID (3 times daily)', duration: '5 days', instructions: 'Take after meals' },
      { name: 'Paracetamol 650mg', dosage: '1 Tablet', frequency: 'SOS (as needed for pain/fever)', duration: '3 days', instructions: 'Maintain 6h gap' },
    ];

    meds.forEach((m: any, idx: number) => {
      doc.fontSize(10).font('Helvetica-Bold').text(`${idx + 1}. ${m.name}`);
      doc.font('Helvetica').text(`   Dosage: ${m.dosage} | Frequency: ${m.frequency} | Duration: ${m.duration}`);
      doc.fontSize(9).font('Helvetica-Oblique').text(`   Instructions: ${m.instructions}`);
      doc.moveDown(0.5);
    });

    doc.moveDown(2);
    doc.fontSize(10).font('Helvetica').text('Doctor Stamp & Signature: ___________________________', { align: 'right' });
  }

  private renderLabReport(doc: PDFKit.PDFDocument, hospital: string, address: string, data: any) {
    this.renderHeader(doc, hospital, address, 'Laboratory Investigation Report');

    doc.fontSize(10).font('Helvetica').text(`Patient: ${data.patientName || 'Jane Doe'} | MRN: ${data.mrn || 'MRN-1001'}`);
    doc.text(`Order ID: ${data.orderId || 'LAB-ORD-101'} | Sample ID: ${data.sampleId || 'SMP-8902'}`);
    doc.text(`Collection Date: ${data.collectionDate || new Date().toISOString()}`);
    doc.moveDown(1);

    const top = doc.y;
    doc.font('Helvetica-Bold');
    doc.text('Test Parameter', 40, top);
    doc.text('Result', 250, top);
    doc.text('Units', 350, top);
    doc.text('Reference Range', 450, top);
    doc.moveTo(40, doc.y + 2).lineTo(555, doc.y + 2).strokeColor('#cbd5e1').stroke();
    doc.font('Helvetica');

    let curY = doc.y + 6;
    const tests = data.results || [
      { parameter: 'Hemoglobin', result: '13.5', unit: 'g/dL', reference: '12.0 - 15.5', isCritical: false },
      { parameter: 'WBC Count', result: '7,200', unit: '/mcL', reference: '4,500 - 11,000', isCritical: false },
      { parameter: 'Platelet Count', result: '240,000', unit: '/mcL', reference: '150,000 - 450,000', isCritical: false },
    ];

    tests.forEach((t: any) => {
      doc.text(t.parameter, 40, curY);
      if (t.isCritical) {
        doc.font('Helvetica-Bold').text(`${t.result} *CRITICAL*`, 250, curY).font('Helvetica');
      } else {
        doc.text(t.result, 250, curY);
      }
      doc.text(t.unit, 350, curY);
      doc.text(t.reference, 450, curY);
      curY += 18;
    });

    doc.moveDown(3);
    doc.text('Authorized Signatory: Consultant Pathologist', { align: 'right' });
  }

  private renderRadiologyReport(doc: PDFKit.PDFDocument, hospital: string, address: string, data: any) {
    this.renderHeader(doc, hospital, address, 'Radiology & Imaging Report');

    doc.fontSize(10).font('Helvetica').text(`Patient: ${data.patientName || 'Jane Doe'} | MRN: ${data.mrn || 'MRN-1001'}`);
    doc.text(`Study: ${data.modality || 'Chest X-Ray PA View'} | Date: ${data.date || new Date().toISOString().split('T')[0]}`);
    doc.text(`Referring Physician: Dr. ${data.doctorName || 'Marcus Bell'}`);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').text('Clinical Indication:');
    doc.font('Helvetica').text(data.indication || 'Persistent non-productive cough, evaluate for consolidation.');
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('Technique & Modality:');
    doc.font('Helvetica').text(data.technique || 'Standard Posteroanterior chest radiograph obtained at 120 kV.');
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('Findings:');
    doc.font('Helvetica').text(data.findings || 'Lungs are clear with no focal consolidation, pneumothorax, or pleural effusion. Cardiothoracic ratio is normal. Bony thorax is intact.');
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('Impression:');
    doc.font('Helvetica').text(data.impression || 'Normal chest radiograph. No acute cardiopulmonary process.');
    doc.moveDown(2);

    doc.text('Reporting Radiologist: Dr. Elena Rostova, MD (Radiology)', { align: 'right' });
  }

  private renderDischargeSummary(doc: PDFKit.PDFDocument, hospital: string, address: string, data: any) {
    this.renderHeader(doc, hospital, address, 'Inpatient Discharge Summary');

    doc.fontSize(10).font('Helvetica').text(`Patient Name: ${data.patientName || 'Jane Doe'} | MRN: ${data.mrn || 'MRN-1001'}`);
    doc.text(`Admission Date: ${data.admissionDate || '2026-09-28'} | Discharge Date: ${data.dischargeDate || '2026-10-02'}`);
    doc.text(`Attending Physician: Dr. ${data.attendingDoctor || 'David Chen'} | Ward/Bed: ${data.bed || 'Ward 3B - Bed 14'}`);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').text('Primary Diagnosis:');
    doc.font('Helvetica').text(data.diagnosis || 'Acute Uncomplicated Appendicitis (ICD-10: K35.80)');
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('Hospital Course & Treatment Summary:');
    doc.font('Helvetica').text(data.hospitalCourse || 'Patient underwent uneventful laparoscopic appendectomy on Day 1. Postoperative recovery was smooth. Tolerating oral diet, afebrile, wound clean and dry.');
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('Discharge Medications:');
    doc.font('Helvetica').text(data.medications || 'Cefuroxime 500mg BID for 3 days; Ibuprofen 400mg TID PRN for 3 days.');
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text('Follow-up Instructions & Emergency Red Flags:');
    doc.font('Helvetica').text(data.followUp || 'OPD review in surgical clinic in 7 days for suture removal. Report immediately if fever >38.5C or increasing abdominal pain occurs.');
    doc.moveDown(2);

    doc.text('Consultant Signoff: ____________________________', { align: 'right' });
  }

  private renderWristband(doc: PDFKit.PDFDocument, hospital: string, data: any) {
    doc.fontSize(9).font('Helvetica-Bold').text(hospital.toUpperCase(), 15, 15);
    doc.fontSize(11).font('Helvetica-Bold').text(data.patientName || 'DOE, JANE', 15, 30);
    doc.fontSize(8).font('Helvetica').text(`MRN: ${data.mrn || 'MRN-1001'} | DOB: ${data.dob || '1995-05-15'}`, 15, 45);
    doc.text(`Sex: ${data.gender || 'F'} | Blood Group: ${data.bloodGroup || 'O+'}`, 15, 58);
    doc.fontSize(8).font('Helvetica-Bold').text(`ALLERGY: ${data.allergies || 'PENICILLIN'}`, 15, 72);

    // Draw simulated barcode representation
    doc.rect(15, 90, 180, 25).stroke();
    doc.fontSize(7).font('Helvetica').text(`*${data.mrn || 'MRN-1001'}*`, 70, 98);
  }

  private renderBarcodeLabel(doc: PDFKit.PDFDocument, hospital: string, data: any) {
    doc.fontSize(8).font('Helvetica-Bold').text(hospital.substring(0, 20), 15, 15);
    doc.fontSize(9).font('Helvetica-Bold').text(`SPECIMEN: ${data.sampleId || 'SMP-2026-9901'}`, 15, 30);
    doc.fontSize(7).font('Helvetica').text(`Patient: ${data.patientName || 'Jane Doe'} (${data.mrn || 'MRN-1001'})`, 15, 45);
    doc.text(`Test: ${data.testName || 'CBC & Electrolytes'} | ${new Date().toISOString().substring(0, 16)}`, 15, 58);

    doc.rect(15, 75, 150, 22).stroke();
    doc.fontSize(7).font('Helvetica').text(`||| | |||| || ||| ${data.sampleId || 'SMP-9901'}`, 30, 82);
  }

  private renderGenericDocument(doc: PDFKit.PDFDocument, hospital: string, data: any) {
    this.renderHeader(doc, hospital, 'Clinical Document', data.title || 'Document');
    doc.fontSize(10).font('Helvetica').text(JSON.stringify(data, null, 2));
  }
}

export const pdfEngine = new PdfEngine();
