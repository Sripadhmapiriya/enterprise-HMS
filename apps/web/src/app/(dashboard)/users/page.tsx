'use client';

import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Shield, CheckCircle2 } from 'lucide-react';
import { Button } from '@enterprise-hms/ui';
import { userApi } from '@/lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await userApi.getUsers();
        if (res?.data && Array.isArray(res.data)) {
          setUsers(res.data);
        }
      } catch {
        // Fallback default
        setUsers([
          {
            id: 'u-1',
            firstName: 'Sarah',
            lastName: 'Jenkins',
            email: 's.jenkins@hospital.org',
            roles: ['ADMIN', 'SUPER_ADMIN'],
            isActive: true,
            lastLoginAt: new Date().toISOString(),
          },
          {
            id: 'u-2',
            firstName: 'Marcus',
            lastName: 'Vance',
            email: 'm.vance@hospital.org',
            roles: ['DOCTOR'],
            isActive: true,
            lastLoginAt: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: 'u-3',
            firstName: 'Elena',
            lastName: 'Rostova',
            email: 'e.rostova@hospital.org',
            roles: ['NURSE'],
            isActive: true,
            lastLoginAt: new Date(Date.now() - 7200000).toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  const filteredUsers = users.filter(
    (u) =>
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text tracking-tight">Users & Role Access</h1>
          <p className="text-xs text-text-muted mt-0.5">Manage staff authentication, RBAC role permissions, and access credentials.</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
          onClick={() => alert('New user registration is available under Human Resources & Staff Master.')}
        >
          Add User
        </Button>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border bg-surface-subtle/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search users by name, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-border rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-brand"
            />
          </div>
          <span className="text-xs text-text-muted font-medium">
            {filteredUsers.length} staff members listed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-text-muted">
            <thead className="bg-surface-subtle border-b border-border text-text-muted uppercase font-semibold">
              <tr>
                <th className="px-6 py-3">Personnel</th>
                <th className="px-6 py-3">Assigned Roles</th>
                <th className="px-6 py-3">Account Status</th>
                <th className="px-6 py-3">Last Active</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-muted">
                    Loading personnel records...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-muted">
                    No matching users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-subtle/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-info-bg text-info-text font-semibold text-xs flex items-center justify-center">
                          {user.firstName?.[0] || 'U'}{user.lastName?.[0] || ''}
                        </div>
                        <div>
                          <div className="font-semibold text-text">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-[11px] text-text-muted">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {(user.roles || ['STAFF']).map((role: string, idx: number) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-subtle text-text border border-border"
                          >
                            <Shield className="w-2.5 h-2.5 mr-1 text-text-muted" />
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-stable-bg text-stable-text border border-stable-border">
                        <CheckCircle2 className="w-3 h-3 text-stable" />
                        {user.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-text-muted font-mono text-[11px]">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Never'}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => alert(`Managing permissions for ${user.email}`)}
                        className="text-info-text hover:text-info-text font-medium text-xs"
                      >
                        Edit Access
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
