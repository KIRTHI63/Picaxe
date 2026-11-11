'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { UploadZone } from '@/components/UploadZone';
import { EmptyState, CardSkeleton } from '@/components/ui/Loading';
import { useToast } from '@/components/ui/Toast';
import {
  Plus, AlertCircle, CheckCircle2, BarChart3, Users,
  Activity, Calendar, ChevronRight, X, Search,
  Image as ImgIcon, Check, LogIn
} from 'lucide-react';
import {
  api,
  getToken,
  getStoredUser,
  OrganizationDashboardData,
  EventRecord,
  ReviewQueueItem,
} from '@/lib/api';

type Section = 'overview' | 'events' | 'review' | 'students' | 'analytics';

const NAV: { id: Section; icon: React.ElementType; label: string }[] = [
  { id: 'overview',   icon: Activity,     label: 'Overview' },
  { id: 'events',     icon: Calendar,     label: 'Events' },
  { id: 'review',     icon: AlertCircle,  label: 'Review Queue' },
  { id: 'students',   icon: Users,        label: 'Students' },
  { id: 'analytics',  icon: BarChart3,    label: 'Analytics' },
];

interface CreateEventModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateEventModal({ onClose, onCreated }: CreateEventModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);

    try {
      const created = await api.events.create({
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        startDate: date ? new Date(date).toISOString() : undefined,
        visibility: 'PUBLIC',
      });
      toast({ type: 'success', title: 'Event created', description: `"${created.title}" persisted in PostgreSQL.` });
      onCreated();
      onClose();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed to create event', description: err?.message || 'Error creating event' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-basalt/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md bg-surface border border-surface-border rounded-xl shadow-overlay overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
          <h2 className="font-sans font-semibold text-bone">Create New Event</h2>
          <button onClick={onClose} className="text-ash hover:text-bone transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="event-title" className="font-mono text-[10px] text-ash uppercase tracking-widest">
              Event Name *
            </label>
            <input
              id="event-title"
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Annual Tech Fest 2026"
              className="w-full bg-basalt border border-surface-border rounded-md px-3 py-2.5 font-sans text-sm text-bone outline-none placeholder-ash/40 focus:border-seam-gold/50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="event-date" className="font-mono text-[10px] text-ash uppercase tracking-widest">
              Event Date
            </label>
            <input
              id="event-date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-basalt border border-surface-border rounded-md px-3 py-2.5 font-sans text-sm text-bone outline-none focus:border-seam-gold/50 transition-colors [color-scheme:dark]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="event-location" className="font-mono text-[10px] text-ash uppercase tracking-widest">
              Location
            </label>
            <input
              id="event-location"
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Main Auditorium"
              className="w-full bg-basalt border border-surface-border rounded-md px-3 py-2.5 font-sans text-sm text-bone outline-none placeholder-ash/40 focus:border-seam-gold/50 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] text-ash uppercase tracking-widest">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe this event..."
              className="w-full bg-basalt border border-surface-border rounded-md px-3 py-2.5 font-sans text-sm text-bone outline-none placeholder-ash/40 focus:border-seam-gold/50 transition-colors resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" size="md" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={loading} className="flex-1">
              {loading ? 'Creating...' : 'Create Event'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function OrgEventRow({ ev, onSelectReview }: { ev: EventRecord; onSelectReview?: (title: string) => void }) {
  const router = useRouter();
  const formattedDate = ev.startDate
    ? new Date(ev.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Scheduled';

  return (
    <div
      onClick={() => router.push(`/organization/events/${ev.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') router.push(`/organization/events/${ev.id}`);
      }}
      className="card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-seam-gold/40 hover:bg-surface-50/40 transition-all cursor-pointer group"
    >
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h3 className="font-sans font-medium text-bone group-hover:text-seam-gold transition-colors">{ev.title}</h3>
          {ev.reviewNeeded > 0 ? (
            <Badge variant="warning" dot pulse>{ev.reviewNeeded} Pending Review</Badge>
          ) : (
            <Badge variant="success" dot>{ev.status}</Badge>
          )}
        </div>
        <p className="font-mono text-[10px] text-ash">
          {formattedDate} · {ev.mediaCount} file{ev.mediaCount !== 1 ? 's' : ''} · {ev.matchCount} match{ev.matchCount !== 1 ? 'es' : ''}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {ev.reviewNeeded > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelectReview?.(ev.title);
            }}
          >
            Review Queue
          </Button>
        )}
        <div className="w-8 h-8 rounded-md flex items-center justify-center text-ash group-hover:text-seam-gold group-hover:bg-surface transition-colors">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

function OverviewSection({
  data,
  onCreateEvent,
  onSelectReview,
  onRefresh,
}: {
  data: OrganizationDashboardData;
  onCreateEvent: () => void;
  onSelectReview: (title: string) => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [selectedEventId, setSelectedEventId] = useState<string>(data.events[0]?.id || '');

  useEffect(() => {
    if (!selectedEventId && data.events.length > 0) {
      setSelectedEventId(data.events[0].id);
    }
  }, [data.events, selectedEventId]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-sans font-semibold text-2xl text-bone">Overview</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant={data.servicesHealth.faceEngineOnline ? 'success' : 'warning'} dot>
              Face Engine {data.servicesHealth.faceEngineOnline ? 'Online' : 'Offline'}
            </Badge>
            <Badge variant={data.servicesHealth.nlpEngineOnline ? 'success' : 'warning'} dot>
              NLP Engine {data.servicesHealth.nlpEngineOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </div>
        <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={onCreateEvent}>
          Create Event
        </Button>
      </div>

      {/* Real Database Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: String(data.stats.totalEvents) },
          { label: 'Media Uploaded', value: String(data.stats.totalMedia) },
          { label: 'Matched Tags', value: String(data.stats.totalMatches) },
          { label: 'Match Rate', value: `${data.stats.matchRate}%` },
        ].map(s => (
          <div key={s.label} className="card p-5">
            <p className="font-sans font-semibold text-2xl text-bone mb-1">{s.value}</p>
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Real Upload Zone */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-sans font-semibold text-lg text-bone">Upload Event Media</h2>
          {data.events.length > 0 && (
            <select
              value={selectedEventId}
              onChange={e => setSelectedEventId(e.target.value)}
              className="bg-surface border border-surface-border rounded-md px-3 py-1.5 text-xs font-sans text-bone outline-none focus:border-seam-gold/50"
              aria-label="Target event for upload"
            >
              {data.events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
          )}
        </div>
        <UploadZone
          eventId={selectedEventId || undefined}
          onComplete={assets => {
            const tags = assets.reduce((s, a) => s + (a.photoTags?.length ?? 0) + (a.certificateTags?.length ?? 0), 0);
            toast({
              type: 'success',
              title: 'Upload & AI complete',
              description: `Stored ${assets.length} file(s); ${tags} real tag(s) created.`,
            });
            onRefresh();
          }}
          onError={msg => toast({ type: 'error', title: 'Upload failed', description: msg })}
        />
      </section>

      {/* Events List */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-sans font-semibold text-lg text-bone">Your Events ({data.events.length})</h2>
        </div>
        {data.events.length > 0 ? (
          <div className="flex flex-col gap-3">
            {data.events.map(ev => <OrgEventRow key={ev.id} ev={ev} onSelectReview={onSelectReview} />)}
          </div>
        ) : (
          <EmptyState
            icon={<Calendar className="w-8 h-8 text-ash" />}
            title="No events in database yet"
            description="Create your first organization event to begin uploading photos and certificates."
            action={
              <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={onCreateEvent}>
                Create Your First Event
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}

function EventsSection({
  events,
  onCreateEvent,
  onSelectReview,
}: {
  events: EventRecord[];
  onCreateEvent: () => void;
  onSelectReview: (title: string) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = events.filter(e => e.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-sans font-semibold text-2xl text-bone">Events</h1>
        <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={onCreateEvent}>
          Create Event
        </Button>
      </div>

      <div className="flex items-center gap-2 bg-surface border border-surface-border rounded-md px-3 py-2 max-w-sm focus-within:border-seam-gold/50 transition-colors">
        <Search className="w-3.5 h-3.5 text-ash shrink-0" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search events..."
          className="bg-transparent text-sm text-bone font-sans outline-none w-full placeholder-ash/40"
        />
      </div>

      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map(ev => <OrgEventRow key={ev.id} ev={ev} onSelectReview={onSelectReview} />)}
        </div>
      ) : (
        <EmptyState
          icon={<Calendar className="w-8 h-8 text-ash" />}
          title="No events found"
          description={events.length === 0 ? "No events created yet." : "No events matched your search query."}
          action={<Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={onCreateEvent}>Create Event</Button>}
        />
      )}
    </div>
  );
}

function ReviewQueueSection({
  items,
  initialSearch = '',
  onRefresh,
}: {
  items: ReviewQueueItem[];
  initialSearch?: string;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState(initialSearch);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (initialSearch) setSearch(initialSearch);
  }, [initialSearch]);

  const filtered = items.filter(r =>
    r.studentName.toLowerCase().includes(search.toLowerCase()) ||
    r.eventTitle.toLowerCase().includes(search.toLowerCase()) ||
    r.filename.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDecision = async (item: ReviewQueueItem, decision: 'CONFIRMED' | 'REJECTED') => {
    setBusyId(item.tagId);
    try {
      if (item.tagType === 'PHOTO') {
        await api.media.reviewPhotoTag(item.tagId, decision);
      } else {
        await api.media.reviewCertTag(item.tagId, decision);
      }
      toast({
        type: decision === 'CONFIRMED' ? 'success' : 'info',
        title: decision === 'CONFIRMED' ? 'Match approved' : 'Match rejected',
        description: `${item.filename} (${item.studentName}) updated in PostgreSQL.`,
      });
      onRefresh();
    } catch (err: any) {
      toast({ type: 'error', title: 'Review failed', description: err?.message || 'Error updating tag' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-sans font-semibold text-2xl text-bone">Review Queue</h1>
          <p className="font-mono text-[10px] text-ash mt-1 uppercase tracking-wide">
            {items.length} real tag{items.length !== 1 ? 's' : ''} awaiting confirmation
          </p>
        </div>
        {items.length > 0 && <Badge variant="warning" dot pulse>{items.length} Pending</Badge>}
      </div>

      {items.length > 0 && (
        <div className="flex items-center gap-2 bg-surface border border-surface-border rounded-md px-3 py-2 max-w-sm focus-within:border-seam-gold/50 transition-colors">
          <Search className="w-3.5 h-3.5 text-ash shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search student, event, or file..."
            className="bg-transparent text-sm text-bone font-sans outline-none w-full placeholder-ash/40"
          />
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map(r => (
            <div key={r.tagId} className="card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-basalt border border-surface-border rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                  {r.publicUrl ? (
                    <img src={r.publicUrl} alt={r.filename} className="w-full h-full object-cover" />
                  ) : (
                    <ImgIcon className="w-5 h-5 text-ash/40" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-sans font-medium text-bone text-sm">{r.studentName}</p>
                    <Badge variant="warning">{r.tagType}</Badge>
                  </div>
                  <p className="font-mono text-[10px] text-ash">{r.filename} · {r.eventTitle}</p>
                  <p className="font-mono text-[10px] text-seam-gold mt-1">
                    {Math.round(r.confidenceScore * 100)}% similarity
                    {r.extractedName ? ` · OCR: "${r.extractedName}"` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busyId === r.tagId}
                  icon={<Check className="w-4 h-4 text-verdigris" />}
                  onClick={() => handleDecision(r, 'CONFIRMED')}
                >
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={busyId === r.tagId}
                  icon={<X className="w-4 h-4 text-danger" />}
                  onClick={() => handleDecision(r, 'REJECTED')}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<CheckCircle2 className="w-8 h-8 text-verdigris" />}
          title="Review queue is clear"
          description="No uncertain AI matches currently require review."
        />
      )}
    </div>
  );
}

function StudentsSection({ students }: { students: OrganizationDashboardData['students'] }) {
  const [search, setSearch] = useState('');
  const filtered = students.filter(s =>
    s.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-sans font-semibold text-2xl text-bone">Registered Students</h1>
        <p className="font-mono text-[10px] text-ash mt-1 uppercase tracking-wide">
          {students.length} student profile{students.length !== 1 ? 's' : ''} in PostgreSQL
        </p>
      </div>

      <div className="flex items-center gap-2 bg-surface border border-surface-border rounded-md px-3 py-2 max-w-sm focus-within:border-seam-gold/50 transition-colors">
        <Search className="w-3.5 h-3.5 text-ash shrink-0" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search student name or email..."
          className="bg-transparent text-sm text-bone font-sans outline-none w-full placeholder-ash/40"
        />
      </div>

      {filtered.length > 0 ? (
        <div className="card divide-y divide-surface-border overflow-hidden">
          {filtered.map(student => (
            <div key={student.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-seam-gold/20 border border-seam-gold/30 flex items-center justify-center font-mono font-semibold text-seam-gold text-base overflow-hidden">
                  {student.avatarUrl ? (
                    <img src={student.avatarUrl} alt={student.fullName} className="w-full h-full object-cover" />
                  ) : (
                    student.fullName.charAt(0)
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-sans font-medium text-bone text-base">{student.fullName}</h3>
                    {student.registrationStatus === 'VERIFIED' ? (
                      <Badge variant="success" dot>Face Verified</Badge>
                    ) : student.registrationStatus === 'REJECTED' ? (
                      <Badge variant="danger" dot>Rejected</Badge>
                    ) : (
                      <Badge variant="warning">Pending Registration</Badge>
                    )}
                  </div>
                  <p className="font-mono text-xs text-ash">
                    {student.email || 'No email'} · {student.institution || 'No institution'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="font-sans font-semibold text-bone text-lg">{student.matchedPhotosCount}</p>
                  <p className="font-mono text-[10px] text-ash uppercase">Photos</p>
                </div>
                <div className="text-right">
                  <p className="font-sans font-semibold text-bone text-lg">{student.matchedCertsCount}</p>
                  <p className="font-mono text-[10px] text-ash uppercase">Certs</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Users className="w-8 h-8 text-ash" />}
          title="No students found"
          description="Registered students in the database will appear here."
        />
      )}
    </div>
  );
}

function AnalyticsSection({ data }: { data: OrganizationDashboardData }) {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-sans font-semibold text-2xl text-bone">Live Analytics</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: String(data.stats.totalEvents) },
          { label: 'Media Assets Stored', value: String(data.stats.totalMedia) },
          { label: 'Matched Tags', value: String(data.stats.totalMatches) },
          { label: 'Match Rate', value: `${data.stats.matchRate}%` },
        ].map(m => (
          <div key={m.label} className="card p-5">
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide mb-3">{m.label}</p>
            <p className="font-sans font-semibold text-2xl text-bone">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="font-sans font-semibold text-lg text-bone mb-3">AI Microservice Connectivity</h2>
        <p className="font-sans text-sm text-ash mb-4">
          Live status queried directly by the NestJS Backend Gateway:
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={data.servicesHealth.faceEngineOnline ? 'success' : 'danger'} dot>
            Face Engine (:8000) — {data.servicesHealth.faceEngineOnline ? 'Connected' : 'Offline'}
          </Badge>
          <Badge variant={data.servicesHealth.nlpEngineOnline ? 'success' : 'danger'} dot>
            NLP Engine (:8001) — {data.servicesHealth.nlpEngineOnline ? 'Connected' : 'Offline'}
          </Badge>
          <Badge variant="success" dot>Supabase PostgreSQL</Badge>
        </div>
      </div>
    </div>
  );
}

export default function OrganizationDashboard() {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [data, setData] = useState<OrganizationDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [reviewSearchQuery, setReviewSearchQuery] = useState('');

  const loadDashboard = useCallback(async () => {
    const token = getToken();
    const user = getStoredUser();
    if (!token || !user) {
      setAuthError('Sign in with an Organization account to view and manage real events.');
      setLoading(false);
      return;
    }
    if (user.role !== 'ORGANIZATION' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      setAuthError(`You are currently signed in as ${user.role} (${user.email}). Organization access requires an ORGANIZATION account.`);
      setLoading(false);
      return;
    }

    setLoading(true);
    setAuthError(null);
    try {
      const res = await api.dashboard.getOrganizationDashboard();
      setData(res);
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to load organization dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleSelectReview = (title: string) => {
    setReviewSearchQuery(title);
    setActiveSection('review');
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col bg-basalt">
        <Navbar context="organization" />
        <main className="flex-1 p-8 max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </main>
      </div>
    );
  }

  if (authError || !data) {
    return (
      <div className="min-h-dvh flex flex-col bg-basalt">
        <Navbar context="organization" />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="card p-8 max-w-md w-full text-center flex flex-col items-center gap-4">
            <AlertCircle className="w-8 h-8 text-seam-gold" />
            <h1 className="font-sans font-semibold text-xl text-bone">Organization Authentication Required</h1>
            <p className="font-sans text-sm text-ash">{authError}</p>
            <Link href="/auth?role=ORGANIZATION&next=/organization">
              <Button variant="primary" size="md" icon={<LogIn className="w-4 h-4" />}>
                Sign In / Create Organization Account
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const navCounts: Partial<Record<Section, number>> = {
    events: data.events.length,
    review: data.reviewQueue.length,
  };

  const sectionContent: Record<Section, React.ReactNode> = {
    overview:  <OverviewSection data={data} onCreateEvent={() => setShowCreateModal(true)} onSelectReview={handleSelectReview} onRefresh={loadDashboard} />,
    events:    <EventsSection events={data.events} onCreateEvent={() => setShowCreateModal(true)} onSelectReview={handleSelectReview} />,
    review:    <ReviewQueueSection items={data.reviewQueue} initialSearch={reviewSearchQuery} onRefresh={loadDashboard} />,
    students:  <StudentsSection students={data.students} />,
    analytics: <AnalyticsSection data={data} />,
  };

  return (
    <div className="min-h-dvh flex flex-col bg-basalt">
      <Navbar context="organization" />

      <div className="flex-1 flex flex-col md:flex-row">
        <aside className="hidden md:flex w-60 border-r border-surface-border flex-col p-3 gap-1 bg-basalt shrink-0">
          {NAV.map(item => {
            const isActive = activeSection === item.id;
            const count = navCounts[item.id];
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md font-sans text-sm transition-all ${
                  isActive
                    ? 'bg-surface text-bone border border-surface-border'
                    : 'text-ash hover:bg-surface-50 hover:text-bone border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </div>
                {count != null && count > 0 && (
                  <span className="font-mono text-[9px] bg-basalt px-1.5 py-0.5 rounded-full border border-surface-border">
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          <div className="mt-auto pt-4 border-t border-surface-border">
            <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-md text-ash hover:text-bone hover:bg-surface-50 transition-all font-sans text-sm">
              ← Back to Home
            </Link>
          </div>
        </aside>

        <div className="flex md:hidden overflow-x-auto gap-1 p-2 border-b border-surface-border bg-basalt shrink-0">
          {NAV.map(item => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-sans text-xs whitespace-nowrap transition-all ${
                  isActive ? 'bg-surface text-bone border border-surface-border' : 'text-ash hover:bg-surface-50'
                }`}
              >
                <item.icon className="w-3.5 h-3.5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {sectionContent[activeSection]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <CreateEventModal
            onClose={() => setShowCreateModal(false)}
            onCreated={loadDashboard}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
