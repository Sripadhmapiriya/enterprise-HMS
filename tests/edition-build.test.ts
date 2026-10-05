import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  buildEdition,
  restoreOriginalRoutes,
} from './scripts/build-edition';

const ROOT_DIR = path.resolve(__dirname, '..');
const DASHBOARD_DIR = path.join(ROOT_DIR, 'apps', 'web', 'src', 'app', '(dashboard)');
const CACHE_DIR = path.join(ROOT_DIR, '.edition-cache');
const MANIFEST_PATH = path.join(ROOT_DIR, '.edition.json');

describe('Workstream D: Edition Build & Physical Route Pruning (patients-only)', () => {
  afterEach(() => {
    // Always guarantee workspace routes are restored
    restoreOriginalRoutes();
  });

  it('1. Prunes disabled module routes physically and creates edition manifest (dry-run)', () => {
    const manifest = buildEdition({
      preset: 'patients-only',
      dryRun: true,
    });

    expect(manifest.presetName).toBe('patients-only');
    expect(manifest.enabledModules).toContain('patients');
    expect(manifest.enabledModules).toContain('foundation');
    expect(manifest.disabledModules).toContain('pharmacy');
    expect(manifest.disabledModules).toContain('ipd');
    expect(manifest.disabledModules).toContain('billing');

    // Verify manifest file exists on disk
    expect(fs.existsSync(MANIFEST_PATH)).toBe(true);

    // Verify cache directory exists with backed up routes
    expect(fs.existsSync(CACHE_DIR)).toBe(true);
    expect(fs.existsSync(path.join(CACHE_DIR, 'meta.json'))).toBe(true);

    // Verify patients route is preserved in web app
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'patients', 'page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'patients', '[id]', 'page.tsx'))).toBe(true);

    // Verify disabled route (e.g. pharmacy) was physically pruned from dashboard
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'pharmacy'))).toBe(false);

    // Now restore and verify restoration
    restoreOriginalRoutes();
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'pharmacy'))).toBe(true);
    expect(fs.existsSync(CACHE_DIR)).toBe(false);
  });

  it('2. Custom module edition pruning (e.g. patients + scheduling + opd)', () => {
    const manifest = buildEdition({
      modules: ['patients', 'scheduling', 'opd'],
      dryRun: true,
    });

    expect(manifest.enabledModules).toEqual(
      expect.arrayContaining(['foundation', 'patients', 'scheduling', 'opd'])
    );
    expect(manifest.disabledModules).toContain('pharmacy');
    expect(manifest.disabledModules).toContain('laboratory');

    // Enabled routes are preserved
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'patients', 'page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'appointments', 'page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'queue', 'page.tsx'))).toBe(true);

    // Disabled routes are pruned
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'laboratory'))).toBe(false);

    // Cleanup
    restoreOriginalRoutes();
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'laboratory'))).toBe(true);
  });

  it('3. Preset matrix: pharmacy-er (verifies pharmacy, emergency, inventory present; ipd, billing absent)', () => {
    const manifest = buildEdition({
      preset: 'pharmacy-er',
      dryRun: true,
    });

    expect(manifest.presetName).toBe('pharmacy-er');
    expect(manifest.enabledModules).toContain('pharmacy');
    expect(manifest.enabledModules).toContain('emergency');
    expect(manifest.enabledModules).toContain('inventory');
    expect(manifest.enabledModules).toContain('patients');
    expect(manifest.disabledModules).toContain('ipd');
    expect(manifest.disabledModules).toContain('billing');
    expect(manifest.disabledModules).toContain('laboratory');

    // Pharmacy and emergency routes are preserved
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'pharmacy', 'page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'operations', 'emergency', 'page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'inventory', 'page.tsx'))).toBe(true);

    // IPD and billing routes are pruned
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'ipd'))).toBe(false);
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'billing'))).toBe(false);

    restoreOriginalRoutes();
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'ipd'))).toBe(true);
    expect(fs.existsSync(path.join(DASHBOARD_DIR, 'billing'))).toBe(true);
  });

  it('4. Preset matrix: opd-clinic, diagnostic-centre, hospital-standard & full-enterprise', () => {
    // opd-clinic
    const opdManifest = buildEdition({ preset: 'opd-clinic', dryRun: true });
    expect(opdManifest.enabledModules).toContain('opd');
    expect(opdManifest.disabledModules).toContain('ipd');
    restoreOriginalRoutes();

    // diagnostic-centre
    const diagManifest = buildEdition({ preset: 'diagnostic-centre', dryRun: true });
    expect(diagManifest.enabledModules).toContain('laboratory');
    expect(diagManifest.enabledModules).toContain('radiology');
    expect(diagManifest.disabledModules).toContain('ot');
    restoreOriginalRoutes();

    // hospital-standard
    const hospManifest = buildEdition({ preset: 'hospital-standard', dryRun: true });
    expect(hospManifest.enabledModules).toContain('ipd');
    expect(hospManifest.enabledModules).toContain('emergency');
    expect(hospManifest.disabledModules).toContain('ambulance');
    restoreOriginalRoutes();

    // full-enterprise
    const fullManifest = buildEdition({ preset: 'full-enterprise', dryRun: true });
    expect(fullManifest.disabledModules).toHaveLength(0);
    expect(fullManifest.prunedRoutes).toHaveLength(0);
    restoreOriginalRoutes();
  });
});
