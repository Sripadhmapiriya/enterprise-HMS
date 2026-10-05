import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { prisma } from '@enterprise-hms/database';
import { getEnv } from '@enterprise-hms/config';
import { requestIdMiddleware } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import tenantRoutes from './routes/tenants';
import hospitalRoutes from './routes/hospitals';
import branchRoutes from './routes/branches';
import departmentRoutes from './routes/departments';
import userRoutes from './routes/users';
import roleRoutes from './routes/roles';
import permissionRoutes from './routes/permissions';
import staffRoutes from './routes/staff';
import doctorRoutes from './routes/doctors';
import settingRoutes from './routes/settings';
import auditRoutes from './routes/audit';
import patientRoutes from './routes/patients';
import schedulingRoutes from './routes/scheduling';
import opdRoutes from './routes/opd';
import enterpriseRoutes from './routes/enterprise';
import licensingRoutes from './routes/licensing';
import inventoryRoutes from './routes/inventory';
import pharmacyRoutes from './routes/pharmacy';
import emergencyRoutes from './routes/emergency';
import billingRoutes from './routes/billing';
import insuranceRoutes from './routes/insurance';
import laboratoryRoutes from './routes/laboratory';
import radiologyRoutes from './routes/radiology';
import ipdRoutes from './routes/ipd';
import icuRoutes from './routes/icu';
import otRoutes from './routes/ot';
import bloodbankRoutes from './routes/bloodbank';
import cssdRoutes from './routes/cssd';
import dietaryRoutes from './routes/dietary';
import housekeepingRoutes from './routes/housekeeping';
import ambulanceRoutes from './routes/ambulance';
import procurementRoutes from './routes/procurement';
import hrRoutes from './routes/hr';
import financeRoutes from './routes/finance';
import assetRoutes from './routes/assets';
import crmRoutes from './routes/crm';
import analyticsRoutes from './routes/analytics';
import integrationRoutes from './routes/integrations';
import platformRoutes from './routes/platform';

dotenv.config();

const env = getEnv();
export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(requestIdMiddleware);

// Liveness check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'enterprise-hms-api',
    timestamp: new Date().toISOString(),
    requestId: req.id,
  });
});

// Readiness check
app.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
      requestId: req.id,
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      requestId: req.id,
    });
  }
});

app.get('/health/database', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected', requestId: req.id });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', requestId: req.id });
  }
});

// Foundation & Auth Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tenants', tenantRoutes);
app.use('/api/v1/hospitals', hospitalRoutes);
app.use('/api/v1/branches', branchRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/permissions', permissionRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/settings', settingRoutes);
app.use('/api/v1/audit', auditRoutes);

// Clinical & Module Routes
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/scheduling', schedulingRoutes);
app.use('/api/v1/appointments', schedulingRoutes);
app.use('/api/v1/queues', schedulingRoutes);
app.use('/api/v1/opd', opdRoutes);
app.use('/api/v1/encounters', opdRoutes);
app.use('/api/v1/enterprise', enterpriseRoutes);
app.use('/api/v1/licensing', licensingRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/pharmacy', pharmacyRoutes);
app.use('/api/v1/emergency', emergencyRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/insurance', insuranceRoutes);
app.use('/api/v1/laboratory', laboratoryRoutes);
app.use('/api/v1/radiology', radiologyRoutes);
app.use('/api/v1/ipd', ipdRoutes);
app.use('/api/v1/icu', icuRoutes);
app.use('/api/v1/ot', otRoutes);
app.use('/api/v1/bloodbank', bloodbankRoutes);
app.use('/api/v1/cssd', cssdRoutes);
app.use('/api/v1/dietary', dietaryRoutes);
app.use('/api/v1/housekeeping', housekeepingRoutes);
app.use('/api/v1/ambulance', ambulanceRoutes);
app.use('/api/v1/procurement', procurementRoutes);
app.use('/api/v1/hr', hrRoutes);
app.use('/api/v1/finance', financeRoutes);
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/crm', crmRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/integrations', integrationRoutes);
app.use('/api/v1/platform', platformRoutes);

// Fallback 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot \${req.method} \${req.path}`,
      requestId: req.id,
    },
  });
});

// Standard Error Envelope Middleware
app.use(errorHandler);

const PORT = env.PORT || 4000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Enterprise HMS API running on port \${PORT}`);
  });
}
