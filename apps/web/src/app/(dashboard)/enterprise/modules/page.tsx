'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Badge,
  Skeleton,
  ErrorState,
  Select,
} from '@enterprise-hms/ui';
import {
  Boxes,
  Check,
  AlertCircle,
  ShieldCheck,
  Layers,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { enterpriseApi } from '@/lib/api';

export default function ModuleManagerPage() {
  const [modules, setModules] = useState<any[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [togglingModule, setTogglingModule] = useState<string | null>(null);

  const loadModules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await enterpriseApi.getModules();
      setModules(res.data?.modules || []);
      setPresets(res.data?.presets || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load enterprise modules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModules();
  }, [loadModules]);

  const handleToggle = async (mod: any) => {
    const nextState = !mod.enabled;
    try {
      setTogglingModule(mod.id);
      await enterpriseApi.toggleModule(mod.id, {
        enabled: nextState,
        autoEnableDependencies: true,
      });
      loadModules();
    } catch (err: any) {
      alert(`Cannot toggle module: ${err.message}`);
    } finally {
      setTogglingModule(null);
    }
  };

  const handleApplyPreset = async () => {
    if (!selectedPreset) return;
    try {
      setApplyingPreset(true);
      await enterpriseApi.applyPreset(selectedPreset);
      alert(`Applied preset "${selectedPreset}". Entitlements updated with immediate effect.`);
      loadModules();
    } catch (err: any) {
      alert(`Preset application failed: ${err.message}`);
    } finally {
      setApplyingPreset(false);
    }
  };

  const groupedModules = React.useMemo(() => {
    const groups: Record<string, any[]> = {
      foundation: [],
      clinical: [],
      diagnostic: [],
      support: [],
      business: [],
      platform: [],
    };
    for (const m of modules) {
      const kind = m.kind || 'support';
      if (!groups[kind]) groups[kind] = [];
      groups[kind].push(m);
    }
    return groups;
  }, [modules]);

  if (loading && modules.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton height={120} className="w-full" />
        <Skeleton height={200} className="w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Module Manager Error"
        message={error}
        onRetry={loadModules}
      />
    );
  }

  const enabledCount = modules.filter((m) => m.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-cyan-600" />
            Tenant Module Manager & Licensing
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Dynamic runtime entitlements with dependency validation and instant cache invalidation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="stable">
            <Check className="w-3.5 h-3.5 mr-1" />
            {enabledCount} / {modules.length} Modules Active
          </Badge>
          <Button variant="outline" size="sm" onClick={loadModules}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Preset Applicator Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-cyan-700" />
          <div>
            <h4 className="font-semibold text-sm text-slate-900">
              Apply Client Edition Preset
            </h4>
            <p className="text-xs text-slate-500">
              Instantly configure the module package according to customer contract tier.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-64">
            <Select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              options={[
                { value: '', label: '-- Select Preset --' },
                ...presets.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.modules.length} mods)`,
                })),
              ]}
            />
          </div>
          <Button
            variant="primary"
            onClick={handleApplyPreset}
            disabled={!selectedPreset || applyingPreset}
            isLoading={applyingPreset}
          >
            Apply Preset
          </Button>
        </div>
      </div>

      {/* Modules Groups */}
      <div className="space-y-6">
        {Object.entries(groupedModules).map(([kind, items]) => {
          if (items.length === 0) return null;
          return (
            <div
              key={kind}
              className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
            >
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                  {kind} Modules ({items.length})
                </h3>
              </div>

              <div className="divide-y divide-slate-100">
                {items.map((mod: any) => {
                  const isFoundation = mod.id === 'foundation';
                  const isBusy = togglingModule === mod.id;

                  return (
                    <div
                      key={mod.id}
                      className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="space-y-1 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {mod.name}
                          </span>
                          <span className="font-mono text-xs text-slate-400">
                            ({mod.id})
                          </span>
                          {isFoundation && (
                            <Badge variant="neutral">Core Platform (Always On)</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{mod.description}</p>
                        {mod.requires?.length > 0 && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <span className="text-[11px] text-slate-400">Requires:</span>
                            {mod.requires.map((req: string) => (
                              <span
                                key={req}
                                className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded text-[10px] font-mono"
                              >
                                {req}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge variant={mod.enabled ? 'stable' : 'neutral'}>
                          {mod.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        {!isFoundation && (
                          <Button
                            variant={mod.enabled ? 'destructive' : 'outline'}
                            size="sm"
                            onClick={() => handleToggle(mod)}
                            isLoading={isBusy}
                          >
                            {mod.enabled ? 'Disable' : 'Enable'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
