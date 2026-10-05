import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { TenantViolationError } from '@enterprise-hms/database';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = req.id || 'unknown';

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    });
  }

  if (err instanceof ZodError || err?.name === 'ZodError' || Array.isArray(err?.issues)) {
    const issues = err.issues || [];
    const details = issues.map((issue: any) => ({
      field: Array.isArray(issue.path) ? issue.path.join('.') : undefined,
      message: issue.message || 'Validation error',
      code: issue.code,
    }));

    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input parameters',
        details,
        requestId,
      },
    });
  }

  if (err instanceof TenantViolationError) {
    return res.status(403).json({
      error: {
        code: 'TENANT_VIOLATION',
        message: err.message,
        requestId,
      },
    });
  }

  // Fallback for unhandled errors
  console.error(`[UnhandledError] [RequestId: \${requestId}]:`, err);

  const isDev = process.env.NODE_ENV !== 'production';
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isDev ? err.message || 'An unexpected error occurred' : 'An unexpected error occurred',
      requestId,
    },
  });
}
