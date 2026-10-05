import dotenv from 'dotenv';
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

dotenv.config();

export interface ProcessedJobResult {
  jobId: string;
  name: string;
  processedAt: string;
  success: boolean;
  result: any;
}

export async function processJobPayload(jobName: string, data: any): Promise<any> {
  switch (jobName) {
    case 'reminders':
      return {
        processedReminders: Array.isArray(data.appointmentIds) ? data.appointmentIds.length : 1,
        channel: data.channel || 'SMS',
        sentAt: new Date().toISOString(),
      };

    case 'notifications':
      return {
        recipientCount: Array.isArray(data.recipients) ? data.recipients.length : 1,
        channel: data.channel || 'EMAIL',
        status: 'DISPATCHED',
      };

    case 'report_generation':
      return {
        reportType: data.reportType || 'MIS_PACK',
        generatedRows: 150,
        completedAt: new Date().toISOString(),
      };

    case 'outbox_relay':
      return {
        relayedEvents: data.eventCount || 3,
        broker: 'IN_PROCESS_BUS',
      };

    case 'scheduled_exports':
      return {
        exportType: data.exportType || 'CENSUS_CSV',
        recordsExported: data.recordCount || 50,
      };

    default:
      return { processed: true, name: jobName };
  }
}

export function startWorker() {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl && redisUrl.startsWith('redis://')) {
    console.log(`[Worker] Connecting to Redis at ${redisUrl}...`);
    try {
      const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

      const worker = new Worker(
        'enterprise-hms-jobs',
        async (job: Job) => {
          console.log(`[Worker] Processing BullMQ job ${job.id} (${job.name})`);
          return processJobPayload(job.name, job.data);
        },
        { connection }
      );

      worker.on('completed', (job: Job) => {
        console.log(`[Worker] Job ${job.id} completed successfully`);
      });

      worker.on('failed', (job: Job | undefined, err: Error) => {
        console.error(`[Worker] Job ${job?.id} failed with error:`, err.message);
      });

      console.log('[Worker] BullMQ Worker started and listening for jobs.');
      return worker;
    } catch (err) {
      console.warn('[Worker] Redis connection failed, falling back to background simulator loop:', err);
    }
  }

  // Fallback simulator loop
  console.log('[Worker] Operating in Local Simulator Mode (Redis not configured).');
  const timer = setInterval(() => {
    // Background heartbeat & simulated outbox relay
  }, 10000);

  return {
    close: () => clearInterval(timer),
    isSimulator: true,
  };
}

if (process.env.NODE_ENV !== 'test') {
  startWorker();
}
