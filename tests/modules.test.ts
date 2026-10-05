import { describe, it, expect } from 'vitest';
import {
  defaultResolver,
  resolvePresetModules,
  listPresets,
  getPreset,
  eventBus,
  StandaloneChargeCapturePort,
} from './packages/modules/src/index';

describe('Workstream B: Module System & Dependency Resolver', () => {
  it('should detect zero cycles in the module catalog (must be a clean DAG)', () => {
    const cycles = defaultResolver.detectCycles();
    expect(cycles).toEqual([]);
  });

  it('should auto-enable hard dependencies (pharmacy -> patients, inventory, foundation)', () => {
    const result = defaultResolver.resolveDependencies(['pharmacy']);
    expect(result.enabled).toContain('pharmacy');
    expect(result.enabled).toContain('inventory');
    expect(result.enabled).toContain('patients');
    expect(result.enabled).toContain('foundation');
    expect(result.autoEnabled).toContain('inventory');
    expect(result.autoEnabled).toContain('patients');
  });

  it('should auto-enable foundation for patients-only', () => {
    const result = defaultResolver.resolveDependencies(['patients']);
    expect(result.enabled).toEqual(expect.arrayContaining(['foundation', 'patients']));
  });

  it('should reject disabling a module that other active modules require', () => {
    const currentlyActive = ['foundation', 'patients', 'inventory', 'pharmacy'];
    
    // Attempt to disable patients while pharmacy is active
    const checkPatients = defaultResolver.canDisable('patients', currentlyActive);
    expect(checkPatients.canDisable).toBe(false);
    expect(checkPatients.requiredBy).toContain('pharmacy');

    // Attempt to disable inventory while pharmacy is active
    const checkInventory = defaultResolver.canDisable('inventory', currentlyActive);
    expect(checkInventory.canDisable).toBe(false);
    expect(checkInventory.requiredBy).toContain('pharmacy');

    // Pharmacy itself can be disabled since nothing depends on it
    const checkPharmacy = defaultResolver.canDisable('pharmacy', currentlyActive);
    expect(checkPharmacy.canDisable).toBe(true);
    expect(checkPharmacy.requiredBy).toEqual([]);
  });

  it('should resolve all 6 built-in client edition presets', () => {
    const presets = listPresets();
    expect(presets.length).toBe(6);

    const patientsOnly = resolvePresetModules('patients-only');
    expect(patientsOnly.enabled).toContain('patients');
    expect(patientsOnly.enabled).toContain('foundation');
    expect(patientsOnly.enabled).not.toContain('pharmacy');

    const pharmacyEr = resolvePresetModules('pharmacy-er');
    expect(pharmacyEr.enabled).toEqual(
      expect.arrayContaining(['foundation', 'emergency', 'pharmacy', 'inventory', 'patients'])
    );
    expect(pharmacyEr.enabled).not.toContain('opd');
    expect(pharmacyEr.enabled).not.toContain('ipd');

    const opdClinic = resolvePresetModules('opd-clinic');
    expect(opdClinic.enabled).toEqual(
      expect.arrayContaining(['foundation', 'opd', 'scheduling', 'billing', 'patients'])
    );

    const fullEnterprise = resolvePresetModules('full-enterprise');
    expect(fullEnterprise.enabled.length).toBeGreaterThanOrEqual(26);
  });

  it('should filter capabilities and navigation according to enabled modules and permissions', () => {
    const capabilities = defaultResolver.getCapabilities(
      ['patients'],
      ['patients.read']
    );

    expect(capabilities.enabledModules).toContain('patients');
    expect(capabilities.enabledModules).not.toContain('pharmacy');
    
    const navRoutes = capabilities.nav.map((n) => n.route);
    expect(navRoutes).toContain('/patients');
    expect(navRoutes).not.toContain('/pharmacy');
  });

  it('should support in-process event bus and decoupled port fallback', async () => {
    let handled = false;
    const unsubscribe = eventBus.subscribe('test.event', (event) => {
      if (event.payload.foo === 'bar') {
        handled = true;
      }
    });

    await eventBus.publish({
      id: 'evt-1',
      name: 'test.event',
      tenantId: 'tenant-1',
      timestamp: new Date().toISOString(),
      payload: { foo: 'bar' },
    });

    expect(handled).toBe(true);
    unsubscribe();

    // Verify fallback port degrades gracefully
    const port = new StandaloneChargeCapturePort();
    const result = await port.postCharge({
      patientId: 'pat-1',
      chargeCode: 'RX-001',
      description: 'Paracetamol',
      quantity: 1,
      unitPrice: 5,
      sourceModule: 'pharmacy',
    });
    expect(result.success).toBe(true);
    expect(result.receiptMode).toBe('POS');
  });
});
