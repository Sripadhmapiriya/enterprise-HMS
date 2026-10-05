import { prisma } from '@enterprise-hms/database';
import { defaultResolver, resolvePresetModules } from '@enterprise-hms/modules';

interface CachedEntitlements {
  modules: string[];
  expiresAt: number;
}

export class EntitlementService {
  private cache = new Map<string, CachedEntitlements>();
  private cacheTtlMs = 60000; // 1 minute TTL

  async getTenantModules(tenantId: string): Promise<string[]> {
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.modules;
    }

    try {
      // Look for custom module configuration stored in system_configurations
      const config = await prisma.systemConfiguration.findFirst({
        where: {
          tenantId,
          configKey: 'enabled_modules',
        },
      });

      let requestedModules: string[] = [];

      if (config && Array.isArray(config.configValue)) {
        requestedModules = config.configValue as string[];
      } else {
        // Default to hospital-standard preset if not explicitly configured
        const standard = resolvePresetModules('hospital-standard');
        requestedModules = standard.enabled;
      }

      const { enabled } = defaultResolver.resolveDependencies(requestedModules);

      this.cache.set(tenantId, {
        modules: enabled,
        expiresAt: Date.now() + this.cacheTtlMs,
      });

      return enabled;
    } catch (err) {
      // Fallback to hospital-standard preset if DB query fails
      const fallback = resolvePresetModules('hospital-standard').enabled;
      return fallback;
    }
  }

  async setTenantModules(tenantId: string, modules: string[]): Promise<string[]> {
    const { enabled } = defaultResolver.resolveDependencies(modules);

    await prisma.systemConfiguration.upsert({
      where: {
        tenantId_hospitalId_branchId_configKey: {
          tenantId,
          hospitalId: '',
          branchId: '',
          configKey: 'enabled_modules',
        },
      },
      update: {
        configValue: enabled,
      },
      create: {
        tenantId,
        hospitalId: '',
        branchId: '',
        configKey: 'enabled_modules',
        configValue: enabled,
      },
    });

    this.cache.set(tenantId, {
      modules: enabled,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return enabled;
  }

  async isModuleEnabled(tenantId: string, moduleId: string): Promise<boolean> {
    if (moduleId === 'foundation') return true;
    const modules = await this.getTenantModules(tenantId);
    return modules.includes(moduleId);
  }

  invalidateCache(tenantId?: string) {
    if (tenantId) {
      this.cache.delete(tenantId);
    } else {
      this.cache.clear();
    }
  }
}

export const entitlementService = new EntitlementService();
