import { PrismaClient } from '@prisma/client';

export class TenantViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantViolationError';
  }
}

// Models that are global or do not have a direct tenantId column
const GLOBAL_OR_UNSCOPED_MODELS = new Set([
  'Tenant',
  'Permission',
  'RolePermission',
  'Enterprise',
  'Subscription',
  'FeatureEntitlement',
]);

export function createTenantClient(tenantId: string, basePrisma: PrismaClient) {
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new TenantViolationError('Tenant context required: tenantId must be provided.');
  }

  return basePrisma.$extends({
    name: 'tenant-isolation-extension',
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (GLOBAL_OR_UNSCOPED_MODELS.has(model)) {
            return query(args);
          }

          if (args.where && (args.where as any).tenantId && (args.where as any).tenantId !== tenantId) {
            throw new TenantViolationError(
              `Cross-tenant query violation: requested tenantId does not match context "\${tenantId}"`
            );
          }

          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },

        async findFirst({ model, args, query }) {
          if (GLOBAL_OR_UNSCOPED_MODELS.has(model)) {
            return query(args);
          }

          if (args.where && (args.where as any).tenantId && (args.where as any).tenantId !== tenantId) {
            throw new TenantViolationError(
              `Cross-tenant query violation: requested tenantId does not match context "\${tenantId}"`
            );
          }

          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },

        async count({ model, args, query }) {
          if (GLOBAL_OR_UNSCOPED_MODELS.has(model)) {
            return query(args);
          }

          if (args.where && (args.where as any).tenantId && (args.where as any).tenantId !== tenantId) {
            throw new TenantViolationError(
              `Cross-tenant count violation: requested tenantId does not match context "\${tenantId}"`
            );
          }

          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },

        async create({ model, args, query }) {
          if (GLOBAL_OR_UNSCOPED_MODELS.has(model)) {
            return query(args);
          }

          const data = args.data as any;
          if (data.tenantId && data.tenantId !== tenantId) {
            throw new TenantViolationError(
              `Cross-tenant write blocked: attempted to create \${model} for foreign tenant "\${data.tenantId}"`
            );
          }

          data.tenantId = tenantId;
          return query(args);
        },

        async updateMany({ model, args, query }) {
          if (GLOBAL_OR_UNSCOPED_MODELS.has(model)) {
            return query(args);
          }

          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },

        async deleteMany({ model, args, query }) {
          if (GLOBAL_OR_UNSCOPED_MODELS.has(model)) {
            return query(args);
          }

          args.where = { ...(args.where || {}), tenantId };
          return query(args);
        },
      },
    },
  });
}
