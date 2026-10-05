import { FOUNDATION_MODULE, MODULE_CATALOG } from './manifests';
import { ModuleCapabilities, ModuleManifest, NavItem } from './types';

export class ModuleResolver {
  private catalog: Map<string, ModuleManifest> = new Map();

  constructor(customCatalog?: Record<string, ModuleManifest>) {
    this.catalog.set(FOUNDATION_MODULE.id, FOUNDATION_MODULE);
    const catalogSource = customCatalog || MODULE_CATALOG;
    for (const [id, manifest] of Object.entries(catalogSource)) {
      this.catalog.set(id, manifest);
    }
  }

  getModule(id: string): ModuleManifest | undefined {
    return this.catalog.get(id);
  }

  getAllModules(): ModuleManifest[] {
    return Array.from(this.catalog.values());
  }

  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (node: string, path: string[]) => {
      visited.add(node);
      stack.add(node);

      const manifest = this.catalog.get(node);
      if (manifest) {
        for (const dep of manifest.requires) {
          if (!this.catalog.has(dep)) continue;
          if (stack.has(dep)) {
            cycles.push([...path, dep]);
          } else if (!visited.has(dep)) {
            dfs(dep, [...path, dep]);
          }
        }
      }

      stack.delete(node);
    };

    for (const id of this.catalog.keys()) {
      if (!visited.has(id)) {
        dfs(id, [id]);
      }
    }

    return cycles;
  }

  resolveDependencies(requestedIds: string[]): {
    enabled: string[];
    autoEnabled: string[];
    missing: string[];
  } {
    const enabled = new Set<string>();
    const autoEnabled = new Set<string>();
    const missing: string[] = [];

    // Foundation is always enabled
    enabled.add('foundation');

    const queue = [...requestedIds];
    const requestedSet = new Set(requestedIds);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (enabled.has(currentId)) continue;

      const manifest = this.catalog.get(currentId);
      if (!manifest) {
        missing.push(currentId);
        continue;
      }

      enabled.add(currentId);
      if (!requestedSet.has(currentId) && currentId !== 'foundation') {
        autoEnabled.add(currentId);
      }

      for (const requiredDep of manifest.requires) {
        if (!enabled.has(requiredDep)) {
          queue.push(requiredDep);
        }
      }
    }

    return {
      enabled: Array.from(enabled),
      autoEnabled: Array.from(autoEnabled),
      missing,
    };
  }

  canDisable(moduleId: string, currentlyEnabled: string[]): {
    canDisable: boolean;
    requiredBy: string[];
  } {
    if (moduleId === 'foundation') {
      return {
        canDisable: false,
        requiredBy: currentlyEnabled.filter((id) => id !== 'foundation'),
      };
    }

    const enabledSet = new Set(currentlyEnabled);
    const dependents: string[] = [];

    for (const enabledId of enabledSet) {
      if (enabledId === moduleId) continue;
      const manifest = this.catalog.get(enabledId);
      if (manifest && manifest.requires.includes(moduleId)) {
        dependents.push(enabledId);
      }
    }

    return {
      canDisable: dependents.length === 0,
      requiredBy: dependents,
    };
  }

  getCapabilities(
    enabledModuleIds: string[],
    userPermissions: string[]
  ): ModuleCapabilities {
    const { enabled } = this.resolveDependencies(enabledModuleIds);
    const enabledSet = new Set(enabled);
    const permissionSet = new Set(userPermissions);
    const isSuperAdmin = permissionSet.has('*') || permissionSet.has('superadmin');

    const navItems: NavItem[] = [];

    for (const moduleId of enabled) {
      const manifest = this.catalog.get(moduleId);
      if (!manifest) continue;

      for (const item of manifest.nav) {
        if (!item.permission || isSuperAdmin || permissionSet.has(item.permission)) {
          navItems.push(item);
        }
      }
    }

    return {
      enabledModules: enabled,
      availableModules: Array.from(this.catalog.keys()).filter((id) => id !== 'foundation'),
      permissions: userPermissions,
      nav: navItems,
    };
  }
}

export const defaultResolver = new ModuleResolver();
