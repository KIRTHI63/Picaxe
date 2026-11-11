'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, CardSkeleton } from '@/components/ui/Loading';
import {
  Shield, Activity, Users, Database, Search, LayoutGrid,
  Filter, CheckCircle2, AlertCircle, LogIn
} from 'lucide-react';
import { api, getToken, getStoredUser, AdminDashboardData } from '@/lib/api';

type AdminSection = 'overview' | 'events' | 'organizations' | 'queues' | 'audit';

const NAV: { id: AdminSection; icon: React.ElementType; label: string }[] = [
  { id: 'overview',      icon: Activity,   label: 'Overview' },
  { id: 'events',        icon: LayoutGrid, label: 'All Events' },
  { id: 'organizations', icon: Users,      label: 'Organizations' },
  { id: 'queues',        icon: Database,   label: 'Processing Jobs' },
  { id: 'audit',         icon: Shield,     label: 'Audit Logs' },
];

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const loadAdmin = useCallback(async () => {
    const token = getToken();
    const user = getStoredUser();
    if (!token || !user) {
      setAuthError('Sign in with an ADMIN account to inspect real platform telemetry and audit logs.');
      setLoading(false);
      return;
    }
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      setAuthError(`Access restricted: signed in as ${user.role} (${user.email}). ADMIN role is required.`);
      setLoading(false);
      return;
    }

    setLoading(true);
    setAuthError(null);
    try {
      const res = await api.dashboard.getAdminDashboard();
      setData(res);
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to load admin console');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col bg-basalt">
        <Navbar context="admin" />
        <main className="flex-1 max-w-5xl mx-auto w-full p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </main>
      </div>
    );
  }

  if (authError || !data) {
    return (
      <div className="min-h-dvh flex flex-col bg-basalt">
        <Navbar context="admin" />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="card p-8 max-w-md w-full text-center flex flex-col items-center gap-4">
            <Shield className="w-8 h-8 text-seam-gold" />
            <h1 className="font-sans font-semibold text-xl text-bone">Admin Access Required</h1>
            <p className="font-sans text-sm text-ash">{authError}</p>
            <Link href="/auth?next=/admin">
              <Button variant="primary" size="md" icon={<LogIn className="w-4 h-4" />}>Sign In</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const filteredLogs = data.auditLogs.filter(l =>
    !filter ||
    l.action.toLowerCase().includes(filter.toLowerCase()) ||
    l.actorName.toLowerCase().includes(filter.toLowerCase()) ||
    l.entityType.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="min-h-dvh flex flex-col bg-basalt">
      <Navbar context="admin" />

      <div className="flex-1 flex flex-col md:flex-row">
        <aside className="hidden md:flex w-60 border-r border-surface-border flex-col p-3 gap-1 bg-basalt shrink-0">
          {NAV.map(item => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md font-sans text-sm transition-all ${
                  isActive ? 'bg-surface text-bone border border-surface-border' : 'text-ash hover:bg-surface-50 hover:text-bone'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </aside>

        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-6"
            >
              {activeSection === 'overview' && (
                <>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <h1 className="font-sans font-semibold text-xl text-bone">System Overview</h1>
                    <div className="flex items-center gap-2">
                      <Badge variant={data.servicesHealth.faceEngineOnline ? 'success' : 'danger'} dot>
                        Face Engine {data.servicesHealth.faceEngineOnline ? 'Online' : 'Offline'}
                      </Badge>
                      <Badge variant={data.servicesHealth.nlpEngineOnline ? 'success' : 'danger'} dot>
                        NLP Engine {data.servicesHealth.nlpEngineOnline ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                      { label: 'Users', value: data.metrics.totalUsers },
                      { label: 'Organizations', value: data.metrics.totalOrganizations },
                      { label: 'Events', value: data.metrics.totalEvents },
                      { label: 'Media Assets', value: data.metrics.totalMediaAssets },
                      { label: 'Active Matches', value: data.metrics.totalMatches },
                      { label: 'Rejection Rate', value: `${data.metrics.correctionRate}%` },
                    ].map(m => (
                      <div key={m.label} className="card p-4">
                        <p className="font-mono text-[10px] text-ash uppercase tracking-wide mb-2">{m.label}</p>
                        <p className="font-sans font-semibold text-2xl text-bone">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {(activeSection === 'overview' || activeSection === 'audit') && (
                <section className="card flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
                    <h2 className="font-sans font-medium text-bone">PostgreSQL Audit Logs ({filteredLogs.length})</h2>
                    <div className="flex items-center gap-2 bg-basalt border border-surface-border rounded-md px-2.5 py-1.5">
                      <Filter className="w-3.5 h-3.5 text-ash" />
                      <input
                        type="text"
                        placeholder="Filter logs..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="bg-transparent text-xs font-mono text-bone outline-none w-36"
                      />
                    </div>
                  </div>
                  {filteredLogs.length > 0 ? (
                    <div className="overflow-auto">
                      <table className="w-full text-left font-mono text-[11px]">
                        <thead className="bg-basalt border-b border-surface-border">
                          <tr>
                            {['Timestamp', 'Actor', 'Action', 'Entity', 'Metadata'].map(h => (
                              <th key={h} className="px-4 py-2.5 text-ash uppercase text-[10px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border">
                          {filteredLogs.map(log => (
                            <tr key={log.id} className="hover:bg-surface-50">
                              <td className="px-4 py-3 text-ash whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                              <td className="px-4 py-3 text-bone whitespace-nowrap">{log.actorName} ({log.actorRole})</td>
                              <td className="px-4 py-3 text-seam-gold">{log.action}</td>
                              <td className="px-4 py-3 text-ash">{log.entityType} · {log.entityId.slice(0, 8)}</td>
                              <td className="px-4 py-3 text-ash/70 max-w-xs truncate">{log.metadata ? JSON.stringify(log.metadata) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState icon={<Shield className="w-6 h-6" />} title="No audit logs yet" description="Actions recorded in PostgreSQL will appear here." />
                  )}
                </section>
              )}

              {activeSection === 'events' && (
                <div className="card divide-y divide-surface-border">
                  {data.events.length > 0 ? data.events.map(ev => (
                    <div key={ev.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-sans font-medium text-bone text-sm">{ev.title}</p>
                        <p className="font-mono text-[10px] text-ash">{ev.orgName} · {ev.mediaCount} media · {ev.matchCount} matches</p>
                      </div>
                      <Badge variant="success">{ev.status}</Badge>
                    </div>
                  )) : (
                    <EmptyState icon={<LayoutGrid className="w-6 h-6" />} title="No events in database" />
                  )}
                </div>
              )}

              {activeSection === 'organizations' && (
                <div className="card divide-y divide-surface-border">
                  {data.organizations.length > 0 ? data.organizations.map(org => (
                    <div key={org.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-sans font-medium text-bone text-sm">{org.name}</p>
                        <p className="font-mono text-[10px] text-ash">Owner: {org.ownerName} · {org.eventsCount} event(s)</p>
                      </div>
                      <Badge variant={org.status === 'ACTIVE' ? 'success' : 'warning'}>{org.status}</Badge>
                    </div>
                  )) : (
                    <EmptyState icon={<Users className="w-6 h-6" />} title="No organizations registered yet" />
                  )}
                </div>
              )}

              {activeSection === 'queues' && (
                <div className="card divide-y divide-surface-border">
                  {data.recentMediaJobs.length > 0 ? data.recentMediaJobs.map(job => (
                    <div key={job.id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-sans font-medium text-bone text-sm">{job.originalFilename}</p>
                        <p className="font-mono text-[10px] text-ash">
                          {job.type} · {job.processingError || new Date(job.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={job.processingStatus === 'COMPLETED' ? 'success' : job.processingStatus === 'FAILED' ? 'danger' : 'info'}>
                        {job.processingStatus}
                      </Badge>
                    </div>
                  )) : (
                    <EmptyState icon={<Database className="w-6 h-6" />} title="No media processing jobs yet" />
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
