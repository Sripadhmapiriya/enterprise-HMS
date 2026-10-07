'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Button,
  Badge,
  Skeleton,
  TableSkeletonRows,
  ErrorState,
  EmptyState,
} from '@enterprise-hms/ui';
import {
  Clock,
  Volume2,
  Stethoscope,
  CheckCircle2,
  UserX,
  SkipForward,
  RotateCcw,
  Users,
} from 'lucide-react';
import { schedulingApi } from '@/lib/api';

export default function QueueBoardPage() {
  const router = useRouter();
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [displayBoard, setDisplayBoard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [qRes, dRes] = await Promise.all([
        schedulingApi.getQueue(),
        schedulingApi.getDisplayBoard(),
      ]);
      setQueueItems(qRes.data || []);
      setDisplayBoard((dRes as any).displayBoard || (dRes as any).data?.displayBoard || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load OPD queue data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
    // Auto-refresh queue every 15 seconds
    const interval = setInterval(loadQueue, 15000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await schedulingApi.updateQueueStatus(id, status);
      loadQueue();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            OPD Queue & Token Board
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Real-time outpatient consultation token calling and waiting room display monitor.
          </p>
          <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-surface-subtle border border-border text-xs text-text-muted">
            <span className="font-semibold text-text">Workflow:</span>
            <span>Check-in creates a token</span>
            <span>&rarr;</span>
            <span className="text-info font-medium">Call</span>
            <span>&rarr;</span>
            <span className="text-brand font-medium">Start Consultation</span>
            <span>&rarr;</span>
            <span className="text-stable font-medium">Complete</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadQueue}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Refresh Queue
          </Button>
          <Link href="/appointments">
            <Button variant="primary">
              <Users className="w-4 h-4 mr-2" />
              Check In Next Patient
            </Button>
          </Link>
        </div>
      </div>

      {/* Large Live Display Board Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Now Calling Panel */}
        <div className="lg:col-span-2 p-6 bg-surface text-brand-foreground rounded-2xl shadow-lg border border-border space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-info animate-pulse" />
              <span className="text-xs uppercase tracking-wider font-semibold text-info">
                Live Consultation Station
              </span>
            </div>
            <span className="text-xs font-mono text-text-muted">
              Auto-sync active
            </span>
          </div>

          {displayBoard?.nowCalling?.length === 0 ? (
            <div className="py-8 text-center text-text-muted text-sm">
              No patient currently being called to a consultation room.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayBoard?.nowCalling?.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="p-4 bg-surface-raised/80 border border-border rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-3xl font-extrabold text-info tabular-nums">
                      {item.token}
                    </span>
                    <Badge variant={item.status === 'IN_CONSULTATION' ? 'warning' : 'stable'}>
                      {item.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-bold text-brand-foreground text-base">
                      {item.patientName}
                    </h3>
                    <p className="text-xs text-text-muted">
                      {item.doctorName} • {item.room}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Up Next & Completed */}
        <div className="p-6 bg-surface border border-border rounded-2xl shadow-sm space-y-4">
          <h3 className="font-semibold text-sm text-text border-b border-border pb-2">
            Up Next in Queue
          </h3>
          {displayBoard?.nextTokens?.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center">No waiting tokens.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {displayBoard?.nextTokens?.map((w: any, idx: number) => (
                <div
                  key={idx}
                  className="px-3 py-1.5 bg-surface-subtle border border-border rounded-lg text-xs font-mono font-bold text-text tabular-nums"
                >
                  {w.token}
                </div>
              ))}
            </div>
          )}

          <h3 className="font-semibold text-sm text-text border-b border-border pb-2 pt-2">
            Recently Completed
          </h3>
          {displayBoard?.recentlyCompleted?.length === 0 ? (
            <p className="text-xs text-text-muted py-2">No completed tokens today.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {displayBoard?.recentlyCompleted?.map((token: string, idx: number) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-stable-bg text-stable-text border border-stable-border rounded text-xs font-mono tabular-nums"
                >
                  {token}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Operator Queue Control Table */}
      <div className="bg-surface rounded-xl border border-border shadow-sm p-5 space-y-4">
        <h3 className="font-bold text-text text-base">
          Queue Operator Management Table
        </h3>

        {loading && queueItems.length === 0 ? (
          <TableSkeletonRows rows={4} cols={6} />
        ) : error ? (
          <ErrorState
            title="Failed to Load Queue"
            message={error}
            onRetry={loadQueue}
          />
        ) : queueItems.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-8 h-8 text-text-muted" />}
            title="Queue Empty"
            description="Patients checked in for today's OPD appointments will appear here with token numbers."
            actionLabel="View Today's Appointments"
            onAction={() => router.push('/appointments')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase text-xs font-semibold">
                <tr>
                  <th className="px-4 py-3">Token</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Doctor</th>
                  <th className="px-4 py-3">Check-In Time</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queueItems.map((item: any) => (
                  <tr key={item.id} className="hover:bg-surface-subtle/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-info-text tabular-nums">
                      {item.queueNumber}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/patients/${item.patientId}`}
                        className="font-medium text-text hover:text-info-text hover:underline"
                      >
                        {item.patient?.firstName} {item.patient?.lastName}
                      </Link>
                      <p className="text-xs text-text-muted font-mono">
                        {item.patient?.mrn}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      Dr. {item.doctor?.user?.firstName} {item.doctor?.user?.lastName}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-text-muted">
                      {new Date(item.checkInTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={item.priority === 'EMERGENCY' ? 'critical' : 'neutral'}>
                        {item.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          item.status === 'COMPLETED'
                            ? 'stable'
                            : item.status === 'IN_CONSULTATION'
                            ? 'warning'
                            : item.status === 'CALLED'
                            ? 'info'
                            : item.status === 'NO_SHOW' || item.status === 'SKIPPED'
                            ? 'critical'
                            : 'neutral'
                        }
                      >
                        {item.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.status === 'WAITING' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateStatus(item.id, 'CALLED')}
                          >
                            <Volume2 className="w-3.5 h-3.5 mr-1 text-info" />
                            Call Token
                          </Button>
                        )}
                        {item.status === 'CALLED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              handleUpdateStatus(item.id, 'IN_CONSULTATION')
                            }
                          >
                            <Stethoscope className="w-3.5 h-3.5 mr-1" />
                            Start Consult
                          </Button>
                        )}
                        {item.status === 'IN_CONSULTATION' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleUpdateStatus(item.id, 'COMPLETED')}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-stable" />
                            Complete
                          </Button>
                        )}
                        {item.status !== 'COMPLETED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(item.id, 'NO_SHOW')}
                            className="text-critical hover:text-critical-text hover:bg-critical-bg"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
