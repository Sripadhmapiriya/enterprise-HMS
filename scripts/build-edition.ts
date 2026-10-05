#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
  EDITION_PRESETS,
  ModuleResolver,
  MODULE_CATALOG,
} from '@enterprise-hms/modules';

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = 'true';
      }
    }
  }
  return options;
}

const ROOT_DIR = path.resolve(__dirname, '..');
const WEB_APP_DIR = path.join(ROOT_DIR, 'apps', 'web', 'src', 'app');
const CACHE_DIR = path.join(ROOT_DIR, '.edition-cache');
const MANIFEST_PATH = path.join(ROOT_DIR, '.edition.json');

export interface EditionManifest {
  presetName: string;
  builtAt: string;
  enabledModules: string[];
  disabledModules: string[];
  prunedRoutes: string[];
}

export function restoreOriginalRoutes() {
  if (!fs.existsSync(CACHE_DIR)) return;

  const backupMetaPath = path.join(CACHE_DIR, 'meta.json');
  if (!fs.existsSync(backupMetaPath)) return;

  const meta = JSON.parse(fs.readFileSync(backupMetaPath, 'utf8'));
  for (const item of meta.backedUpRoutes || []) {
    const targetPath = path.join(WEB_APP_DIR, item.relPath);
    const backupPath = path.join(CACHE_DIR, item.backupRelPath);

    if (fs.existsSync(backupPath)) {
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      }
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.cpSync(backupPath, targetPath, { recursive: true });
    }
  }

  fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  if (fs.existsSync(MANIFEST_PATH)) {
    fs.rmSync(MANIFEST_PATH, { force: true });
  }
  console.log('✓ Restored all original routes from edition cache.');
}

export function buildEdition(presetOrModules: {
  preset?: string;
  modules?: string[];
  dryRun?: boolean;
}) {
  const resolver = new ModuleResolver();
  let requestedModules: string[] = [];
  const presetKey = presetOrModules.preset || 'patients-only';

  if (presetOrModules.preset) {
    const preset = EDITION_PRESETS[presetOrModules.preset];
    if (!preset) {
      throw new Error(`Unknown preset "${presetOrModules.preset}". Valid presets: ${Object.keys(EDITION_PRESETS).join(', ')}`);
    }
    requestedModules = preset.modules;
  } else if (presetOrModules.modules) {
    requestedModules = presetOrModules.modules;
  } else {
    requestedModules = EDITION_PRESETS['patients-only'].modules;
  }

  const { enabled: enabledModules } = resolver.resolveDependencies(requestedModules);
  const enabledSet = new Set(enabledModules);

  const disabledModules = Object.keys(MODULE_CATALOG).filter(
    (id) => !enabledSet.has(id) && id !== 'foundation'
  );

  console.log(`\n========================================`);
  console.log(`Building Modular Edition: ${presetKey}`);
  console.log(`Enabled Modules (${enabledModules.length}): ${enabledModules.join(', ')}`);
  console.log(`Disabled Modules (${disabledModules.length}): ${disabledModules.join(', ')}`);
  console.log(`========================================\n`);

  // Ensure clean state first
  restoreOriginalRoutes();

  // Map disabled modules to web routes to prune physically
  const prunedRoutes: string[] = [];
  const backedUpRoutes: { relPath: string; backupRelPath: string }[] = [];

  for (const disModId of disabledModules) {
    const manifest = MODULE_CATALOG[disModId];
    if (!manifest || !manifest.web || !manifest.web.routes) continue;

    for (const route of manifest.web.routes) {
      // route is e.g. "/pharmacy" or "/operations/emergency" or "/ipd"
      const cleanRoute = route.replace(/^\//, '');
      const routeDir = path.join(WEB_APP_DIR, '(dashboard)', cleanRoute);

      if (fs.existsSync(routeDir)) {
        const backupRel = path.join('backup', cleanRoute);
        const backupDest = path.join(CACHE_DIR, backupRel);
        fs.mkdirSync(path.dirname(backupDest), { recursive: true });
        fs.cpSync(routeDir, backupDest, { recursive: true });

        backedUpRoutes.push({
          relPath: path.join('(dashboard)', cleanRoute),
          backupRelPath: backupRel,
        });

        // Physically remove the directory from apps/web
        fs.rmSync(routeDir, { recursive: true, force: true });
        prunedRoutes.push(route);
        console.log(`- Pruned disabled route: ${route}`);
      }
    }
  }

  // Save backup metadata
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(CACHE_DIR, 'meta.json'),
    JSON.stringify({ backedUpRoutes }, null, 2),
    'utf8'
  );

  // Write edition manifest
  const editionManifest: EditionManifest = {
    presetName: presetKey,
    builtAt: new Date().toISOString(),
    enabledModules,
    disabledModules,
    prunedRoutes,
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(editionManifest, null, 2), 'utf8');
  console.log(`✓ Edition manifest created at ${MANIFEST_PATH}`);

  if (presetOrModules.dryRun) {
    console.log('✓ Dry-run complete. Routes pruned and manifest generated.');
    return editionManifest;
  }

  // Run real Next.js and API build
  console.log('\nRunning build for edition...');
  try {
    execSync('npm run build --workspace=@enterprise-hms/api', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
    execSync('npm run build --workspace=web', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
    console.log(`\n✓ Successfully built edition: ${presetKey}`);
  } catch (err: any) {
    console.error(`Edition build failed for ${presetKey}:`, err);
    throw err;
  }

  return editionManifest;
}

async function main() {
  const options = parseArgs();

  if (options['restore']) {
    restoreOriginalRoutes();
    return;
  }

  buildEdition({
    preset: options['preset'],
    modules: options['modules'] ? options['modules'].split(',').map((m) => m.trim()) : undefined,
    dryRun: options['dry-run'] === 'true',
  });
}

if (require.main === module || process.argv[1]?.includes('build-edition')) {
  main();
}
