import { z } from 'zod';

// ==========================================
// API ENVELOPE & ERROR CONTRACTS
// ==========================================

export const ApiErrorDetailSchema = z.object({
  field: z.string().optional(),
  message: z.string(),
  code: z.string().optional(),
});
export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;

export const ApiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(ApiErrorDetailSchema).optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;

export const ApiSuccessEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z
      .object({
        page: z.number().optional(),
        limit: z.number().optional(),
        total: z.number().optional(),
        requestId: z.string().optional(),
      })
      .optional(),
  });

// ==========================================
// PAGINATION & QUERY CONTRACTS
// ==========================================

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// ==========================================
// AUTHENTICATION & SESSION SCHEMAS
// ==========================================

export const LoginInputSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RefreshTokenInputSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
export type RefreshTokenInput = z.infer<typeof RefreshTokenInputSchema>;

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must include at least one uppercase letter')
    .regex(/[0-9]/, 'Must include at least one number'),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

export const MfaVerifyInputSchema = z.object({
  mfaCode: z.string().length(6, 'MFA code must be exactly 6 digits'),
});
export type MfaVerifyInput = z.infer<typeof MfaVerifyInputSchema>;

export interface AuthTokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  roles: string[];
  permissions: string[];
  hospitalId?: string;
  branchId?: string;
  sessionId?: string;
}

export const AuthUserSummarySchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  tenantId: z.string(),
  tenantName: z.string(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});
export type AuthUserSummary = z.infer<typeof AuthUserSummarySchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  user: AuthUserSummarySchema,
  enabledModules: z.array(z.string()),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// ==========================================
// PATIENT 360 & CLINICAL BANNER
// ==========================================

export const PatientBannerSchema = z.object({
  id: z.string(),
  mrn: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string().optional(),
  gender: z.string(),
  bloodGroup: z.string().optional(),
  phone: z.string().optional(),
  allergies: z.array(z.string()),
  alerts: z.array(z.string()),
});
export type PatientBanner = z.infer<typeof PatientBannerSchema>;

// ==========================================
// AUDIT LOGGING SCHEMA
// ==========================================

export const AuditLogInputSchema = z.object({
  tenantId: z.string(),
  userId: z.string().optional(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  before: z.any().optional(),
  after: z.any().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});
export type AuditLogInput = z.infer<typeof AuditLogInputSchema>;
