import { describe, it, expect } from 'vitest';
import { cn } from '../packages/ui/src/utils';
import { PermissionGate } from '../packages/ui/src/PermissionGate';
import React from 'react';

describe('Workstream C: Design System & Packages/UI Components', () => {
  it('cn utility merges tailwind classes and conditional logic correctly', () => {
    const result = cn(
      'px-4 py-2 font-medium',
      true && 'bg-cyan-600',
      false && 'text-white',
      'px-6' // Should override px-4
    );
    expect(result).toContain('px-6');
    expect(result).not.toContain('px-4');
    expect(result).toContain('bg-cyan-600');
    expect(result).toContain('font-medium');
  });

  describe('PermissionGate RBAC Logic', () => {
    it('grants access when user has super-admin wildcard (*)', () => {
      const element = PermissionGate({
        permission: 'patients.create',
        userPermissions: ['*'],
        children: 'Allowed Content',
      });
      expect(element.props.children).toBe('Allowed Content');
    });

    it('grants access when user has direct permission match', () => {
      const element = PermissionGate({
        permission: 'pharmacy.dispense.create',
        userPermissions: ['patients.view', 'pharmacy.dispense.create'],
        children: 'Allowed Content',
      });
      expect(element.props.children).toBe('Allowed Content');
    });

    it('grants access when user has domain wildcard (pharmacy.*)', () => {
      const element = PermissionGate({
        permission: 'pharmacy.dispense.create',
        userPermissions: ['pharmacy.*'],
        children: 'Allowed Content',
      });
      expect(element.props.children).toBe('Allowed Content');
    });

    it('renders fallback when user lacks required permission', () => {
      const element = PermissionGate({
        permission: 'enterprise.admin.update',
        userPermissions: ['patients.view', 'opd.consultation.view'],
        fallback: 'Denied Fallback',
        children: 'Allowed Content',
      });
      expect(element.props.children).toBe('Denied Fallback');
    });
  });

  describe('Clinical Semantics & Token Enforcement', () => {
    it('defines distinct clinical status tokens for all 5 required healthcare states', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const tokensCss = fs.readFileSync(
        path.resolve(process.cwd(), 'packages/ui/src/tokens.css'),
        'utf-8'
      );

      // Verify all 5 clinical tokens exist in CSS
      expect(tokensCss).toContain('--clinical-critical-bg');
      expect(tokensCss).toContain('--clinical-critical-fg');
      expect(tokensCss).toContain('--clinical-warning-bg');
      expect(tokensCss).toContain('--clinical-warning-fg');
      expect(tokensCss).toContain('--clinical-stable-bg');
      expect(tokensCss).toContain('--clinical-stable-fg');
      expect(tokensCss).toContain('--clinical-info-bg');
      expect(tokensCss).toContain('--clinical-info-fg');
      expect(tokensCss).toContain('--clinical-neutral-bg');
      expect(tokensCss).toContain('--clinical-neutral-fg');

      // Verify tabular-nums enforcement class is defined
      expect(tokensCss).toContain('.tabular-nums');
      expect(tokensCss).toContain('font-variant-numeric: tabular-nums');
    });

    it('enforces that Badge exports and implements icon + text pairing', async () => {
      const { Badge } = await import('../packages/ui/src/Badge');
      expect(Badge).toBeDefined();

      // Test rendering badge with critical variant
      const criticalBadge = Badge({
        variant: 'critical',
        children: 'Heart Rate High',
      });

      expect(criticalBadge.props.className).toContain('tabular-nums');
      expect(criticalBadge.props.className).toContain('bg-red-50');
      // Children array contains icon + text element so status is never conveyed by color alone
      expect(criticalBadge.props.children[0]).toBeDefined(); // icon
      expect(criticalBadge.props.children[1].props.children).toBe('Heart Rate High');
    });
  });
});
