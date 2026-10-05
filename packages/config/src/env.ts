import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters for security'),
  JWT_REFRESH_SECRET: z.string().min(16).optional(),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(7),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

let parsedConfig: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (parsedConfig) return parsedConfig;

  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const formattedErrors = result.error.issues
      .map((err) => `  - \${err.path.join('.')}: \${err.message}`)
      .join('\n');
    console.error('Environment configuration validation failed:\n' + formattedErrors);
    throw new Error('Invalid environment configuration');
  }

  parsedConfig = result.data;
  return parsedConfig;
}
