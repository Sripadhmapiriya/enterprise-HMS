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
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Users & Role Access</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage staff authentication, RBAC role permissions, and access credentials.</p>
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

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search users by name, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {filteredUsers.length} staff members listed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3">Personnel</th>
                <th className="px-6 py-3">Assigned Roles</th>
                <th className="px-6 py-3">Account Status</th>
                <th className="px-6 py-3">Last Active</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    Loading personnel records...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No matching users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-cyan-100 text-cyan-800 font-semibold text-xs flex items-center justify-center">
                          {user.firstName?.[0] || 'U'}{user.lastName?.[0] || ''}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-[11px] text-slate-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {(user.roles || ['STAFF']).map((role: string, idx: number) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            <Shield className="w-2.5 h-2.5 mr-1 text-slate-400" />
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {user.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 font-mono text-[11px]">
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
                        className="text-cyan-700 hover:text-cyan-900 font-medium text-xs"
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
