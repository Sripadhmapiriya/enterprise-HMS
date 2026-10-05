import { Request, Response, NextFunction } from 'express';
import { prisma, createTenantClient } from '@enterprise-hms/database';
import { AuthTokenPayload } from '@enterprise-hms/types';
import { authService } from '../services/authService';
import { entitlementService } from '../services/entitlementService';
import { AppError } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
      tenantId?: string;
      hospitalId?: string;
      branchId?: string;
      prismaTenant?: any;
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return next(AppError.unauthorized('Authentication token missing.'));
  }

  try {
    const payload = authService.verifyAccessToken(token);
    req.user = payload;
    req.tenantId = payload.tenantId;
    req.hospitalId = payload.hospitalId;
    req.branchId = payload.branchId;

    // Attach tenant-scoped Prisma client
    req.prismaTenant = createTenantClient(payload.tenantId, prisma);

    next();
  } catch (err) {
    next(err);
  }
}

export function requirePermission(permissionCode: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    const permissions = req.user.permissions || [];
    const hasPermission =
      permissions.includes('*') ||
      permissions.includes('superadmin') ||
      permissions.includes(permissionCode) ||
      permissions.some((p) => {
        if (p.endsWith('.*')) {
          const prefix = p.slice(0, -2);
          return permissionCode.startsWith(prefix + '.');
        }
        return false;
      });

    if (!hasPermission) {
      return next(
        AppError.forbidden(`Missing required permission: "${permissionCode}"`)
      );
    }

    next();
  };
}

export function requireRole(roleName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    const roles = req.user.roles || [];
    const hasRole = roles.includes('SuperAdmin') || roles.includes(roleName);

    if (!hasRole) {
      return next(AppError.forbidden(`Missing required role: "${roleName}"`));
    }

    next();
  };
}

export function requireModule(moduleId: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.tenantId || (req.headers['x-tenant-id'] as string);

    if (!tenantId) {
      // If tenantId is not yet resolved, require auth
      return next(AppError.unauthorized('Tenant context required to evaluate module access'));
    }

    try {
      const isEnabled = await entitlementService.isModuleEnabled(tenantId, moduleId);
      if (!isEnabled) {
        // Return 404 MODULE_NOT_ENABLED so module existence is not leaked
        return next(AppError.moduleNotEnabled(moduleId));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function clearEntitlementsCache(tenantId?: string) {
  entitlementService.invalidateCache(tenantId);
}
