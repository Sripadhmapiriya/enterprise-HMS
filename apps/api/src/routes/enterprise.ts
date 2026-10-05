import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requirePermission } from '../middleware/auth';
import { clearEntitlementsCache } from '../middleware/auth';
import { AppError } from '../utils/errors';
import {
  ModuleResolver,
  MODULE_CATALOG,
  EDITION_PRESETS,
} from '@enterprise-hms/modules';

const router = Router();
const resolver = new ModuleResolver();

const ToggleModuleSchema = z.object({
  enabled: z.boolean(),
  autoEnableDependencies: z.boolean().default(true),
});

const ApplyPresetSchema = z.object({
  presetId: z.string().min(1),
});

// All routes require authentication
router.use(authenticateToken);

// GET /api/v1/enterprise/modules (List all modules & tenant entitlement status)
router.get('/modules', requirePermission('enterprise.modules.read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;

    // Fetch tenant entitlements from database
    const entitlements = await req.prismaTenant.tenantEntitlement.findMany({
      where: { tenantId },
    });

    const entitlementMap = new Map(entitlements.map((e: any) => [e.moduleId, e.enabled]));

    const allModules = resolver.getAllModules().map((mod) => {
      // Foundation is always enabled
      const isEnabled = mod.id === 'foundation' ? true : (entitlementMap.get(mod.id) ?? false);

      return {
        id: mod.id,
        name: mod.name,
        description: mod.description,
        kind: mod.kind,
        requires: mod.requires,
        integratesWith: mod.integratesWith,
        enabled: isEnabled,
        limits: mod.limits || null,
        routes: mod.web.routes,
      };
    });

    res.json({
      success: true,
      data: {
        modules: allModules,
        presets: Object.values(EDITION_PRESETS).map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          modules: p.modules,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/enterprise/modules/:id (Toggle module entitlement with dependency checks)
router.put('/modules/:id', requirePermission('enterprise.modules.manage'), async (req, res, next) => {
  try {
    const moduleId = req.params.id;
    const { enabled, autoEnableDependencies } = ToggleModuleSchema.parse(req.body);
    const tenantId = req.tenantId!;

    if (moduleId === 'foundation' && !enabled) {
      throw AppError.badRequest('The Foundation platform module cannot be disabled');
    }

    const targetManifest = resolver.getModule(moduleId);
    if (!targetManifest) {
      throw AppError.notFound(`Module "${moduleId}" not found in catalog`);
    }

    // Fetch all currently enabled modules for tenant
    const currentEntitlements = await req.prismaTenant.tenantEntitlement.findMany({
      where: { tenantId, enabled: true },
    });
    const currentlyEnabled = currentEntitlements.map((e: any) => e.moduleId);
    if (!currentlyEnabled.includes('foundation')) currentlyEnabled.push('foundation');

    const affectedModules: string[] = [];

    if (!enabled) {
      // Check if disabling violates dependency chain of other active modules
      const { canDisable, requiredBy } = resolver.canDisable(moduleId, currentlyEnabled);
      if (!canDisable) {
        throw AppError.badRequest(
          `Cannot disable "${targetManifest.name}" (${moduleId}) because it is required by active modules: ${requiredBy.join(', ')}`,
          'MODULE_DEPENDENCY_ERROR'
        );
      }

      await req.prismaTenant.tenantEntitlement.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId } },
        update: { enabled: false },
        create: { tenantId, moduleId, enabled: false },
      });
      affectedModules.push(moduleId);
    } else {
      // Enabling: check dependencies
      if (autoEnableDependencies) {
        const { autoEnabled } = resolver.resolveDependencies([...currentlyEnabled, moduleId]);
        const modulesToEnable = [moduleId, ...autoEnabled];

        for (const modToEnable of modulesToEnable) {
          await req.prismaTenant.tenantEntitlement.upsert({
            where: { tenantId_moduleId: { tenantId, moduleId: modToEnable } },
            update: { enabled: true },
            create: { tenantId, moduleId: modToEnable, enabled: true },
          });
          affectedModules.push(modToEnable);
        }
      } else {
        await req.prismaTenant.tenantEntitlement.upsert({
          where: { tenantId_moduleId: { tenantId, moduleId } },
          update: { enabled: true },
          create: { tenantId, moduleId, enabled: true },
        });
        affectedModules.push(moduleId);
      }
    }

    // Explicit cache invalidation
    clearEntitlementsCache(tenantId);

    // Audit Log
    try {
      await req.prismaTenant.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: enabled ? 'MODULE_ENABLED' : 'MODULE_DISABLED',
          entity: 'TenantEntitlement',
          entityId: moduleId,
          after: {
            moduleId,
            enabled,
            affectedModules,
          },
        },
      });
    } catch {
      // Non-blocking audit log
    }

    res.json({
      success: true,
      message: `Module "${targetManifest.name}" \${enabled ? 'enabled' : 'disabled'} successfully`,
      data: {
        moduleId,
        enabled,
        affectedModules,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/enterprise/modules/apply-preset
router.post('/modules/apply-preset', requirePermission('enterprise.modules.manage'), async (req, res, next) => {
  try {
    const { presetId } = ApplyPresetSchema.parse(req.body);
    const tenantId = req.tenantId!;

    const preset = EDITION_PRESETS[presetId];
    if (!preset) {
      throw AppError.badRequest(`Unknown preset "${presetId}". Valid presets: ${Object.keys(EDITION_PRESETS).join(', ')}`);
    }

    const { enabled: resolvedModules } = resolver.resolveDependencies(preset.modules);
    const resolvedSet = new Set(resolvedModules);

    const allCatalogModules = resolver.getAllModules();

    await Promise.all(
      allCatalogModules.map((mod) => {
        const isEnabled = resolvedSet.has(mod.id);
        return req.prismaTenant.tenantEntitlement.upsert({
          where: { tenantId_moduleId: { tenantId, moduleId: mod.id } },
          update: { enabled: isEnabled },
          create: { tenantId, moduleId: mod.id, enabled: isEnabled },
        });
      })
    );

    clearEntitlementsCache(tenantId);

    // Audit
    try {
      await req.prismaTenant.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'PRESET_APPLIED',
          entity: 'Tenant',
          entityId: tenantId,
          after: {
            presetId,
            enabledModules: resolvedModules,
          },
        },
      });
    } catch {
      // Non-blocking audit log
    }

    res.json({
      success: true,
      message: `Preset "${preset.name}" applied successfully`,
      data: {
        presetId,
        enabledModules: resolvedModules,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
