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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            OPD Queue & Token Board
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time outpatient consultation token calling and waiting room display monitor.
          </p>
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
        <div className="lg:col-span-2 p-6 bg-slate-900 text-white rounded-2xl shadow-lg border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-cyan-400 animate-pulse" />
              <span className="text-xs uppercase tracking-wider font-semibold text-cyan-400">
                Live Consultation Station
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Auto-sync active
            </span>
          </div>

          {displayBoard?.nowCalling?.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No patient currently being called to a consultation room.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayBoard?.nowCalling?.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-800/80 border border-slate-700 rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-3xl font-extrabold text-cyan-400 tabular-nums">
                      {item.token}
                    </span>
                    <Badge variant={item.status === 'IN_CONSULTATION' ? 'warning' : 'stable'}>
                      {item.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">
                      {item.patientName}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {item.doctorName} • {item.room}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Up Next & Completed */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
          <h3 className="font-semibold text-sm text-slate-900 border-b border-slate-100 pb-2">
            Up Next in Queue
          </h3>
          {displayBoard?.nextTokens?.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No waiting tokens.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {displayBoard?.nextTokens?.map((w: any, idx: number) => (
                <div
                  key={idx}
                  className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 tabular-nums"
                >
                  {w.token}
                </div>
              ))}
            </div>
          )}

          <h3 className="font-semibold text-sm text-slate-900 border-b border-slate-100 pb-2 pt-2">
            Recently Completed
          </h3>
          {displayBoard?.recentlyCompleted?.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No completed tokens today.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {displayBoard?.recentlyCompleted?.map((token: string, idx: number) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-xs font-mono tabular-nums"
                >
                  {token}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Operator Queue Control Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h3 className="font-bold text-slate-900 text-base">
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
            icon={<Clock className="w-8 h-8 text-slate-400" />}
            title="Queue Empty"
            description="Patients checked in for today's OPD appointments will appear here with token numbers."
            actionLabel="View Today's Appointments"
            onAction={() => router.push('/appointments')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold">
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
              <tbody className="divide-y divide-slate-100">
                {queueItems.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-cyan-800 tabular-nums">
                      {item.queueNumber}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/patients/${item.patientId}`}
                        className="font-medium text-slate-900 hover:text-cyan-700 hover:underline"
                      >
                        {item.patient?.firstName} {item.patient?.lastName}
                      </Link>
                      <p className="text-xs text-slate-400 font-mono">
                        {item.patient?.mrn}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      Dr. {item.doctor?.user?.firstName} {item.doctor?.user?.lastName}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-slate-500">
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
                            <Volume2 className="w-3.5 h-3.5 mr-1 text-cyan-600" />
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
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            Complete
                          </Button>
                        )}
                        {item.status !== 'COMPLETED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(item.id, 'NO_SHOW')}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
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
