import argon2 from 'argon2';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '@enterprise-hms/database';
import { AuthTokenPayload } from '@enterprise-hms/types';
import { AppError } from '../utils/errors';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface FailedAttemptTracker {
  attempts: number;
  lockedUntil?: number;
}

export class AuthService {
  private failedAttempts = new Map<string, FailedAttemptTracker>();

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
    });
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    // 1. Argon2 verification
    if (hash.startsWith('$argon2')) {
      try {
        return await argon2.verify(hash, password);
      } catch (err) {
        return false;
      }
    }

    // 2. Backward compatibility with legacy scrypt hashes (salt:derivedKey)
    if (hash.includes(':')) {
      const [salt, key] = hash.split(':');
      if (!salt || !key) return false;

      return new Promise<boolean>((resolve) => {
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
          if (err) return resolve(false);
          resolve(key === derivedKey.toString('hex'));
        });
      });
    }

    return false;
  }

  checkAccountLockout(email: string) {
    const key = email.toLowerCase();
    const tracker = this.failedAttempts.get(key);

    if (tracker?.lockedUntil && tracker.lockedUntil > Date.now()) {
      const remainingMinutes = Math.ceil((tracker.lockedUntil - Date.now()) / 60000);
      throw AppError.locked(
        `Account is temporarily locked due to multiple failed login attempts. Please try again in \${remainingMinutes} minutes.`
      );
    }
  }

  recordFailedLogin(email: string) {
    const key = email.toLowerCase();
    const tracker = this.failedAttempts.get(key) || { attempts: 0 };
    tracker.attempts += 1;

    if (tracker.attempts >= MAX_FAILED_ATTEMPTS) {
      tracker.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
      this.failedAttempts.set(key, tracker);
      throw AppError.locked(
        'Account locked: 5 consecutive failed login attempts. Account is locked for 15 minutes.'
      );
    }

    this.failedAttempts.set(key, tracker);
  }

  resetFailedAttempts(email: string) {
    this.failedAttempts.delete(email.toLowerCase());
  }

  generateAccessToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: 'enterprise-hms',
      subject: payload.userId,
    });
  }

  verifyAccessToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET, { issuer: 'enterprise-hms' }) as AuthTokenPayload;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw AppError.unauthorized('Access token has expired', 'TOKEN_EXPIRED');
      }
      throw AppError.unauthorized('Invalid access token', 'TOKEN_INVALID');
    }
  }

  generateRefreshToken(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async createSession(userId: string, refreshToken: string) {
    const hashedToken = this.hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    return prisma.session.create({
      data: {
        userId,
        token: hashedToken,
        expiresAt,
      },
    });
  }

  async verifyAndRotateSession(refreshToken: string) {
    const hashedToken = this.hashRefreshToken(refreshToken);

    const session = await prisma.session.findUnique({
      where: { token: hashedToken },
      include: {
        user: {
          include: {
            tenant: true,
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
            staffRecord: {
              include: {
                branch: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw AppError.unauthorized('Invalid refresh session', 'SESSION_INVALID');
    }

    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      throw AppError.unauthorized('Refresh session has expired', 'SESSION_EXPIRED');
    }

    if (!session.user.isActive) {
      throw AppError.forbidden('User account is deactivated');
    }

    // Rotate refresh token
    const newRefreshToken = this.generateRefreshToken();
    const newHashedToken = this.hashRefreshToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: newHashedToken,
        expiresAt: newExpiresAt,
      },
    });

    return {
      session,
      user: session.user,
      newRefreshToken,
    };
  }

  async revokeSession(refreshToken: string) {
    const hashedToken = this.hashRefreshToken(refreshToken);
    await prisma.session.deleteMany({
      where: { token: hashedToken },
    });
  }

  async logSecurityEvent(
    tenantId: string,
    action: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    details?: any
  ) {
    try {
      let targetTenantId = tenantId;
      if (!tenantId || tenantId === 'system') {
        const fallbackTenant = await prisma.tenant.findFirst({ select: { id: true } });
        if (!fallbackTenant) return;
        targetTenantId = fallbackTenant.id;
      }

      await prisma.auditLog.create({
        data: {
          tenantId: targetTenantId,
          userId,
          action,
          entity: 'SecurityEvent',
          entityId: userId || 'anonymous',
          ipAddress,
          userAgent,
          after: details,
        },
      });
    } catch (err) {
      // Graceful fallback for non-blocking security audit
    }
  }
}

export const authService = new AuthService();
