import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { prisma } from '@enterprise-hms/database';
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

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', async (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/database', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

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

app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/queues', queueRoutes);
app.use('/api/v1/encounters', encounterRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: { message: 'Internal Server Error' } });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Enterprise HMS API running on port ${PORT}`);
});
