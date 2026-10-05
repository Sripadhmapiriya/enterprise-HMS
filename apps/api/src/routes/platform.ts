import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { AppError } from '../utils/errors';
import { storageService } from '../services/storage';
import { notificationService, NotificationPayload } from '../services/notifications';
import { csvImportService, ImportDomain } from '../services/csv-import';
import { pdfEngine, PdfTemplateType } from '../services/pdf-engine';
import { workerQueue, JobType } from '../services/worker';

const router = Router();
router.use(authenticateToken);

// ==========================================
// 1. FILE STORAGE ENDPOINTS
// ==========================================

const UploadUrlSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

router.post('/files/upload-url', async (req, res, next) => {
  try {
    const { filename, mimeType, sizeBytes } = UploadUrlSchema.parse(req.body);
    const tenantId = req.tenantId!;

    const result = await storageService.generateUploadUrl(tenantId, filename, mimeType, sizeBytes);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/files/upload', async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const filename = (req.body.filename as string) || 'upload.bin';
    const mimeType = (req.body.mimeType as string) || 'application/pdf';
    const base64Content = req.body.content as string;

    if (!base64Content) {
      throw AppError.badRequest('File content (base64) is required');
    }

    const buffer = Buffer.from(base64Content, 'base64');
    const meta = await storageService.uploadFile(tenantId, filename, mimeType, buffer);

    res.status(201).json({ success: true, data: meta });
  } catch (err: any) {
    if (err.code === 'VIRUS_DETECTED') {
      return res.status(422).json({
        error: {
          code: 'VIRUS_DETECTED',
          message: 'Antivirus scan rejected the file upload: Malicious signature detected',
          requestId: req.id,
        },
      });
    }
    next(err);
  }
});

router.get('/files/download-url', async (req, res, next) => {
  try {
    const key = req.query.key as string;
    if (!key) throw AppError.badRequest('Key query parameter is required');

    const tenantId = req.tenantId!;
    const result = await storageService.generateDownloadUrl(key, tenantId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. NOTIFICATIONS ENDPOINTS
// ==========================================

const SendNotificationSchema = z.object({
  recipientId: z.string().min(1),
  recipientContact: z.string().optional(),
  title: z.string().min(1),
  message: z.string().min(1),
  channel: z.enum(['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP']),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
  metadata: z.record(z.any()).optional(),
});

router.post('/notifications/send', async (req, res, next) => {
  try {
    const input = SendNotificationSchema.parse(req.body);
    const tenantId = req.tenantId!;

    const payload: NotificationPayload = {
      tenantId,
      ...input,
    };

    const result = await notificationService.dispatch(payload);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/notifications', async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const recipientId = (req.query.recipientId as string) || req.user!.userId;
    const unreadOnly = req.query.unreadOnly === 'true';

    const list = await notificationService.getInAppNotifications(tenantId, recipientId, unreadOnly);
    res.json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
});

router.get('/notifications/unread-count', async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const recipientId = (req.query.recipientId as string) || req.user!.userId;

    const count = await notificationService.getUnreadCount(tenantId, recipientId);
    res.json({ success: true, data: { unreadCount: count } });
  } catch (err) {
    next(err);
  }
});

router.put('/notifications/:id/read', async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const notifId = req.params.id;

    const success = await notificationService.markAsRead(tenantId, notifId);
    if (!success) {
      throw AppError.notFound('Notification not found or access denied');
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    next(err);
  }
});

router.get('/notifications/simulator-outbox', async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const logs = await notificationService.getSimulatorOutbox(tenantId);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 3. CSV IMPORT ENDPOINTS
// ==========================================

const CsvImportSchema = z.object({
  domain: z.enum(['patients', 'items', 'tariffs', 'staff']),
  csvContent: z.string().min(1),
  hospitalId: z.string().optional(),
});

router.post('/import/validate', async (req, res, next) => {
  try {
    const { domain, csvContent } = CsvImportSchema.parse(req.body);
    const report = csvImportService.validateCsv(domain as ImportDomain, csvContent);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

router.post('/import/commit', async (req, res, next) => {
  try {
    const { domain, csvContent, hospitalId } = CsvImportSchema.parse(req.body);
    const tenantId = req.tenantId!;

    let targetHospitalId = hospitalId;
    if (!targetHospitalId) {
      const hosp = await req.prismaTenant.hospital.findFirst({ where: { tenantId } });
      targetHospitalId = hosp?.id;
    }

    if (!targetHospitalId) {
      throw AppError.badRequest('Hospital ID required for CSV commit');
    }

    const report = csvImportService.validateCsv(domain as ImportDomain, csvContent);

    if (report.validRecords.length === 0) {
      throw AppError.badRequest('Cannot commit CSV: 0 valid records found in payload');
    }

    const importedCount = await csvImportService.commitImport(
      req.prismaTenant,
      tenantId,
      targetHospitalId,
      domain as ImportDomain,
      report.validRecords
    );

    res.json({
      success: true,
      message: `Successfully imported ${importedCount} ${domain} records`,
      data: {
        domain,
        totalRows: report.totalRows,
        importedCount,
        invalidCount: report.invalidRows,
        errors: report.errors,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 4. PDF ENGINE & PRINT TEMPLATES
// ==========================================

router.get('/print/templates', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'invoice', name: 'Tax Invoice', category: 'financial', description: 'Itemized charges, GST, balance' },
      { id: 'receipt', name: 'Payment Receipt', category: 'financial', description: 'Cashier payment acknowledgment' },
      { id: 'prescription', name: 'Medical Prescription (Rx)', category: 'clinical', description: 'Doctor Rx with medication table' },
      { id: 'lab_report', name: 'Laboratory Investigation Report', category: 'diagnostic', description: 'Parameters with reference ranges' },
      { id: 'radiology_report', name: 'Radiology & Imaging Report', category: 'diagnostic', description: 'Modality, findings, impression' },
      { id: 'discharge_summary', name: 'Inpatient Discharge Summary', category: 'clinical', description: 'Hospital course, diagnosis, discharge Rx' },
      { id: 'wristband', name: 'Patient Identification Wristband', category: 'clinical', description: 'MRN, barcode, allergy flag' },
      { id: 'barcode_label', name: 'Specimen Barcode Label', category: 'diagnostic', description: 'Sample ID barcode for blood tubes' },
    ],
  });
});

const PrintGenerateSchema = z.object({
  template: z.enum([
    'invoice',
    'receipt',
    'prescription',
    'lab_report',
    'radiology_report',
    'discharge_summary',
    'wristband',
    'barcode_label',
  ]),
  hospitalName: z.string().optional(),
  hospitalAddress: z.string().optional(),
  data: z.record(z.any()),
  returnFormat: z.enum(['buffer', 'base64']).optional().default('base64'),
});

router.post('/print/generate', async (req, res, next) => {
  try {
    const input = PrintGenerateSchema.parse(req.body);

    const pdfBuffer = await pdfEngine.generatePdf({
      template: input.template as PdfTemplateType,
      hospitalName: input.hospitalName,
      hospitalAddress: input.hospitalAddress,
      data: input.data,
    });

    if (input.returnFormat === 'buffer' || req.query.download === 'true') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${input.template}-${Date.now()}.pdf"`);
      return res.send(pdfBuffer);
    }

    res.json({
      success: true,
      data: {
        template: input.template,
        sizeBytes: pdfBuffer.length,
        base64: pdfBuffer.toString('base64'),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 5. WORKER JOBS (BULLMQ + SIMULATOR)
// ==========================================

const EnqueueJobSchema = z.object({
  jobType: z.enum(['reminders', 'notifications', 'report_generation', 'outbox_relay', 'scheduled_exports']),
  payload: z.record(z.any()),
});

router.post('/jobs/enqueue', async (req, res, next) => {
  try {
    const { jobType, payload } = EnqueueJobSchema.parse(req.body);
    const tenantId = req.tenantId!;

    const job = await workerQueue.enqueue(jobType as JobType, tenantId, payload);
    res.status(202).json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
});

router.get('/jobs/:id', async (req, res, next) => {
  try {
    const job = await workerQueue.getJobStatus(req.params.id);
    if (!job) throw AppError.notFound('Job not found');

    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
});

router.get('/jobs', async (req, res, next) => {
  try {
    const jobs = await workerQueue.listJobs(req.tenantId);
    res.json({ success: true, data: jobs, isSimulator: workerQueue.isSimulator() });
  } catch (err) {
    next(err);
  }
});

export default router;
