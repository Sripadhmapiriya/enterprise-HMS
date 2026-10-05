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
import appointmentRoutes from './routes/appointments';
import queueRoutes from './routes/queues';
import encounterRoutes from './routes/encounters';

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
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/queues', queueRoutes);
app.use('/api/v1/encounters', encounterRoutes);

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
