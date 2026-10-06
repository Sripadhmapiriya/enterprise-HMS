import { Router } from 'express';
import { prisma } from '@enterprise-hms/database';
import {
  LoginInputSchema,
  RefreshTokenInputSchema,
  ChangePasswordInputSchema,
} from '@enterprise-hms/types';
import { defaultResolver } from '@enterprise-hms/modules';
import { authService } from '../services/authService';
import { entitlementService } from '../services/entitlementService';
import { authenticateToken } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

// POST /api/v1/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = LoginInputSchema.parse(req.body);

    authService.checkAccountLockout(email);

    const user = await prisma.user.findUnique({
      where: { email },
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
      },
    });

    if (!user || !user.isActive) {
      authService.recordFailedLogin(email);
      await authService.logSecurityEvent(
        user?.tenantId || 'system',
        'auth.login.failed',
        user?.id,
        req.ip,
        req.headers['user-agent'] as string,
        { reason: 'User not found or inactive', email }
      );
      throw AppError.unauthorized('Invalid email or password');
    }

    const isPasswordValid = await authService.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      authService.recordFailedLogin(email);
      await authService.logSecurityEvent(
        user.tenantId,
        'auth.login.failed',
        user.id,
        req.ip,
        req.headers['user-agent'] as string,
        { reason: 'Invalid password', email }
      );
      throw AppError.unauthorized('Invalid email or password');
    }

    // Reset failed attempts upon successful login
    authService.resetFailedAttempts(email);

    // Auto-upgrade legacy password hash to Argon2id if needed
    if (!user.passwordHash.startsWith('$argon2')) {
      const modernHash = await authService.hashPassword(password);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: modernHash },
      }).catch(() => {});
    }

    // Extract roles and permissions
    const roles: string[] = [];
    const permissionsSet = new Set<string>();

    for (const ur of user.roles) {
      roles.push(ur.role.name);
      if (ur.role.isSystem || ur.role.name === 'System Administrator' || ur.role.name === 'Super Admin') {
        permissionsSet.add('*');
      }
      for (const rp of ur.role.permissions) {
        permissionsSet.add(`\${rp.permission.category}.\${rp.permission.action}`);
      }
    }

    const permissions = Array.from(permissionsSet);

    // Generate tokens
    const accessToken = authService.generateAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles,
      permissions,
    });

    const refreshToken = authService.generateRefreshToken();
    await authService.createSession(user.id, refreshToken);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const enabledModules = await entitlementService.getTenantModules(user.tenantId);

    await authService.logSecurityEvent(
      user.tenantId,
      'auth.login.success',
      user.id,
      req.ip,
      req.headers['user-agent'] as string
    );

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
          roles,
          permissions,
        },
        enabledModules,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = RefreshTokenInputSchema.parse(req.body);

    const { user, newRefreshToken } = await authService.verifyAndRotateSession(refreshToken);

    const roles: string[] = [];
    const permissionsSet = new Set<string>();

    for (const ur of user.roles) {
      roles.push(ur.role.name);
      if (ur.role.isSystem || ur.role.name === 'System Administrator' || ur.role.name === 'Super Admin') {
        permissionsSet.add('*');
      }
      for (const rp of ur.role.permissions) {
        permissionsSet.add(`\${rp.permission.category}.\${rp.permission.action}`);
      }
    }

    const accessToken = authService.generateAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles,
      permissions: Array.from(permissionsSet),
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 900,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const refreshToken = req.body?.refreshToken;

    if (refreshToken) {
      await authService.revokeSession(refreshToken);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        tenant: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw AppError.notFound('User not found');
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: user.tenantId,
        tenantName: user.tenant.name,
        roles: req.user!.roles,
        permissions: req.user!.permissions,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/capabilities
router.get('/capabilities', authenticateToken, async (req, res, next) => {
  try {
    const enabledModules = await entitlementService.getTenantModules(req.tenantId!);
    const capabilities = defaultResolver.getCapabilities(
      enabledModules,
      req.user!.permissions
    );

    res.json({
      success: true,
      data: capabilities,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/change-password
router.post('/change-password', authenticateToken, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = ChangePasswordInputSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      throw AppError.notFound('User not found');
    }

    const isValid = await authService.verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      throw AppError.badRequest('Current password does not match');
    }

    const modernHash = await authService.hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: modernHash },
    });

    await authService.logSecurityEvent(
      user.tenantId,
      'auth.password.changed',
      user.id,
      req.ip,
      req.headers['user-agent'] as string
    );

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
