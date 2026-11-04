'use client';
import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { UploadZone } from '@/components/UploadZone';
import { EmptyState } from '@/components/ui/Loading';
import { useToast } from '@/components/ui/Toast';
import {
  Plus, AlertCircle, CheckCircle2, Clock, BarChart3, Users,
  Activity, Calendar, ChevronRight, X, AlertTriangle, Search,
  Image as ImgIcon, TrendingUp, Eye
} from 'lucide-react';

// ─── Data ────────────────────────────────────────────────────────────────────

type EventStatus = 'done' | 'review' | 'processing';

interface OrgEvent {
  id: string;
  title: string;
  date: string;
  media: number;
  matches: number;
  reviewNeeded: number;
  status: EventStatus;
}

const INITIAL_EVENTS: OrgEvent[] = [
  { id: 'evt-1', title: 'Engineering Hackathon', date: 'Yesterday', media: 1450, matches: 890, reviewNeeded: 0, status: 'done' },
  { id: 'evt-2', title: 'Alumni Dinner 2026', date: '3 days ago', media: 320, matches: 210, reviewNeeded: 12, status: 'review' },
  { id: 'evt-3', title: 'Convocation 2026', date: 'Processing...', media: 4200, matches: 0, reviewNeeded: 0, status: 'processing' },
];

const REVIEW_QUEUE = [
  { id: 'r1', photo: 'photo_824.jpg', event: 'Alumni Dinner 2026', student: 'John Doe', confidence: 71, flag: 'Low confidence' },
  { id: 'r2', photo: 'photo_825.jpg', event: 'Alumni Dinner 2026', student: 'Jane Smith', confidence: 68, flag: 'Partial face' },
  { id: 'r3', photo: 'group_shot_01.jpg', event: 'Alumni Dinner 2026', student: 'Alex Johnson', confidence: 75, flag: 'Multiple faces' },
  { id: 'r4', photo: 'photo_830.jpg', event: 'Alumni Dinner 2026', student: 'Maria Garcia', confidence: 65, flag: 'Low confidence' },
];

const STUDENTS = [
  { id: 's1', name: 'John Doe', email: 'john@university.edu', events: 3, photos: 42, registered: 'Jan 2026' },
  { id: 's2', name: 'Jane Smith', email: 'jane@university.edu', events: 2, photos: 28, registered: 'Feb 2026' },
  { id: 's3', name: 'Alex Johnson', email: 'alex@university.edu', events: 4, photos: 63, registered: 'Dec 2025' },
  { id: 's4', name: 'Maria Garcia', email: 'maria@university.edu', events: 1, photos: 9, registered: 'Mar 2026' },
  { id: 's5', name: 'Chris Lee', email: 'chris@university.edu', events: 3, photos: 37, registered: 'Jan 2026' },
];

// ─── Nav config ──────────────────────────────────────────────────────────────

type Section = 'overview' | 'events' | 'review' | 'students' | 'analytics';

const NAV: { id: Section; icon: React.ElementType; label: string }[] = [
  { id: 'overview',   icon: Activity,     label: 'Overview' },
  { id: 'events',     icon: Calendar,     label: 'Events' },
  { id: 'review',     icon: AlertCircle,  label: 'Review Queue' },
  { id: 'students',   icon: Users,        label: 'Students' },
  { id: 'analytics',  icon: BarChart3,    label: 'Analytics' },
];

// ─── Create Event Modal ───────────────────────────────────────────────────────

interface CreateEventModalProps {
  onClose: () => void;
  onCreate: (event: OrgEvent) => void;
}

function CreateEventModal({ onClose, onCreate }: CreateEventModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setTimeout(() => {
      const newEvent: OrgEvent = {
        id: `evt-${Date.now()}`,
        title: title.trim(),
        date: date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        media: 0,
        matches: 0,
        reviewNeeded: 0,
        status: 'processing',
      };
      onCreate(newEvent);
      toast({ type: 'success', title: 'Event created', description: `"${title}" is ready for media uploads.` });
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-basalt/80 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
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

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-5">
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
            <label className="font-mono text-[10px] text-ash uppercase tracking-widest">Description</label>
            <textarea
              rows={3}
              placeholder="Optional: describe this event..."
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

// ─── Sections ─────────────────────────────────────────────────────────────────

function OverviewSection({ events, onCreateEvent, onSelectReview }: { events: OrgEvent[]; onCreateEvent: () => void; onSelectReview?: (title: string) => void }) {
  const { toast } = useToast();
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-sans font-semibold text-2xl text-bone">Overview</h1>
        <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={onCreateEvent}>
          Create Event
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: String(events.length) },
          { label: 'Media Processed', value: `${(events.reduce((s, e) => s + e.media, 0) / 1000).toFixed(1)}K` },
          { label: 'Students Matched', value: events.reduce((s, e) => s + e.matches, 0).toLocaleString() },
          { label: 'Match Rate', value: '84%' },
        ].map(s => (
          <div key={s.label} className="card p-5">
            <p className="font-sans font-semibold text-2xl text-bone mb-1">{s.value}</p>
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Upload */}
      <section>
        <h2 className="font-sans font-semibold text-lg text-bone mb-4">Upload Event Media</h2>
        <UploadZone
          onComplete={count => {
            toast({ type: 'success', title: 'AI matching complete', description: `${count} students automatically matched.` });
          }}
        />
      </section>

      {/* Events */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-sans font-semibold text-lg text-bone">Recent Events</h2>
        </div>
        <div className="flex flex-col gap-3">
          {events.map(ev => <OrgEventRow key={ev.id} ev={ev} onSelectReview={onSelectReview} />)}
        </div>
      </section>
    </div>
  );
}

function EventsSection({ events, onCreateEvent, onSelectReview }: { events: OrgEvent[]; onCreateEvent: () => void; onSelectReview?: (title: string) => void }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | EventStatus>('all');
  const filtered = events.filter(e =>
    (filter === 'all' || e.status === filter) &&
    e.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-sans font-semibold text-2xl text-bone">Events</h1>
        <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={onCreateEvent}>
          Create Event
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-surface border border-surface-border rounded-md px-3 py-2 flex-1 min-w-48 max-w-sm focus-within:border-seam-gold/50 transition-colors">
          <Search className="w-3.5 h-3.5 text-ash shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search events..."
            className="bg-transparent text-sm text-bone font-sans outline-none w-full placeholder-ash/40"
          />
        </div>
        <div className="flex items-center gap-1 bg-surface border border-surface-border p-1 rounded-md">
          {(['all', 'done', 'review', 'processing'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-sans rounded-sm capitalize transition-all ${filter === f ? 'bg-basalt text-bone border border-surface-border' : 'text-ash hover:text-bone'}`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map(ev => <OrgEventRow key={ev.id} ev={ev} onSelectReview={onSelectReview} />)}
        </div>
      ) : (
        <EmptyState
          icon={<Calendar className="w-6 h-6" />}
          title="No events found"
          description="Try adjusting your search or create a new event."
          action={<Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={onCreateEvent}>Create Event</Button>}
        />
      )}
    </div>
  );
}

function ReviewQueueSection({ initialSearch = '' }: { initialSearch?: string }) {
  const { toast } = useToast();
  const [items, setItems] = useState(REVIEW_QUEUE);
  const [search, setSearch] = useState(initialSearch);

  React.useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
    }
  }, [initialSearch]);
  const filtered = items.filter(r =>
    r.student.toLowerCase().includes(search.toLowerCase()) ||
    r.event.toLowerCase().includes(search.toLowerCase()) ||
    r.photo.toLowerCase().includes(search.toLowerCase())
  );

  const approve = (id: string) => {
    setItems(prev => prev.filter(r => r.id !== id));
    toast({ type: 'success', title: 'Match approved', description: 'Student notified of their matched photo.' });
  };
  const reject = (id: string) => {
    setItems(prev => prev.filter(r => r.id !== id));
    toast({ type: 'info', title: 'Match rejected', description: 'Photo removed from student gallery.' });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-sans font-semibold text-2xl text-bone">Review Queue</h1>
          <p className="font-mono text-[10px] text-ash mt-1 uppercase tracking-wide">
            {items.length} item{items.length !== 1 ? 's' : ''} need human review
          </p>
        </div>
        <Badge variant="warning" dot pulse>{items.length} Pending</Badge>
      </div>

      {items.length > 0 && (
        <div className="flex items-center gap-2 bg-surface border border-surface-border rounded-md px-3 py-2 max-w-sm focus-within:border-seam-gold/50 transition-colors">
          <Search className="w-3.5 h-3.5 text-ash shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search student or event..."
            className="bg-transparent text-sm text-bone font-sans outline-none w-full placeholder-ash/40"
          />
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map(r => (
            <div key={r.id} className="card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-basalt border border-surface-border rounded-lg flex items-center justify-center shrink-0">
                  <ImgIcon className="w-5 h-5 text-ash/40" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-sans font-medium text-bone text-sm">{r.student}</p>
                    <Badge variant="warning">{r.flag}</Badge>
                  </div>
                  <p className="font-mono text-[10px] text-ash">{r.photo} · {r.event}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="h-1 w-24 bg-basalt rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-seam-gold"
                        style={{ width: `${r.confidence}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-ash">{r.confidence}% confidence</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" icon={<Eye className="w-4 h-4" />}>Preview</Button>
                <Button variant="danger" size="sm" onClick={() => reject(r.id)}>Reject</Button>
                <Button variant="primary" size="sm" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => approve(r.id)}>
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<CheckCircle2 className="w-6 h-6" />}
          title="All clear!"
          description="No matches need human review right now."
        />
      )}
    </div>
  );
}

function StudentsSection() {
  const [search, setSearch] = useState('');
  const filtered = STUDENTS.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-sans font-semibold text-2xl text-bone">Students</h1>
          <p className="font-mono text-[10px] text-ash mt-1 uppercase tracking-wide">{STUDENTS.length} registered</p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-surface border border-surface-border rounded-md px-3 py-2 max-w-sm focus-within:border-seam-gold/50 transition-colors">
        <Search className="w-3.5 h-3.5 text-ash shrink-0" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="bg-transparent text-sm text-bone font-sans outline-none w-full placeholder-ash/40"
        />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left" role="table" aria-label="Registered students">
          <thead className="bg-basalt border-b border-surface-border">
            <tr>
              {['Student', 'Email', 'Events', 'Photos', 'Registered'].map(h => (
                <th key={h} className="px-4 py-3 font-mono text-[10px] text-ash uppercase tracking-wider" scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-surface-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-seam-gold-muted border border-seam-gold/20 flex items-center justify-center shrink-0">
                      <span className="font-sans font-semibold text-xs text-seam-gold">{s.name[0]}</span>
                    </div>
                    <span className="font-sans text-sm text-bone">{s.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ash">{s.email}</td>
                <td className="px-4 py-3 font-mono text-xs text-bone">{s.events}</td>
                <td className="px-4 py-3 font-mono text-xs text-bone">{s.photos}</td>
                <td className="px-4 py-3 font-mono text-xs text-ash">{s.registered}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 flex flex-col items-center gap-2">
            <Users className="w-6 h-6 text-ash/30" />
            <p className="font-sans text-sm text-ash">No students match your search</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsSection() {
  const bars = [
    { month: 'Oct', events: 2, matches: 1200 },
    { month: 'Nov', events: 3, matches: 2100 },
    { month: 'Dec', events: 1, matches: 800 },
    { month: 'Jan', events: 4, matches: 3200 },
    { month: 'Feb', events: 3, matches: 2800 },
    { month: 'Mar', events: 2, matches: 1900 },
  ];
  const maxMatches = Math.max(...bars.map(b => b.matches));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-sans font-semibold text-2xl text-bone">Analytics</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Avg Match Rate', value: '84%', trend: '+2.1%', up: true },
          { label: 'Avg Processing Time', value: '12s', trend: '-3s', up: true },
          { label: 'False Positive Rate', value: '1.4%', trend: '-0.3%', up: true },
          { label: 'Total Students', value: '8,920', trend: '+340', up: true },
        ].map(m => (
          <div key={m.label} className="card p-5">
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide mb-3">{m.label}</p>
            <div className="flex items-end justify-between">
              <p className="font-sans font-semibold text-2xl text-bone">{m.value}</p>
              <span className="font-mono text-xs text-verdigris flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> {m.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="font-sans font-semibold text-lg text-bone mb-6">Matches Over Time</h2>
        <div className="flex items-end gap-4 h-48">
          {bars.map((b, i) => (
            <div key={b.month} className="flex-1 flex flex-col items-center gap-2">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(b.matches / maxMatches) * 100}%` }}
                transition={{ delay: i * 0.08, duration: 0.4, ease: 'easeOut' }}
                className="w-full bg-seam-gold/20 rounded-t-md border border-seam-gold/30 relative group cursor-default"
              >
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-surface border border-surface-border rounded px-2 py-1 whitespace-nowrap">
                  <span className="font-mono text-[10px] text-bone">{b.matches.toLocaleString()} matches</span>
                </div>
              </motion.div>
              <span className="font-mono text-[10px] text-ash">{b.month}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Event Row ────────────────────────────────────────────────────────────────

function OrgEventRow({ ev, onSelectReview }: { ev: OrgEvent; onSelectReview?: (eventTitle: string) => void }) {
  const router = useRouter();
  const statusBadge = {
    done:       <Badge variant="success" dot>Processed</Badge>,
    review:     <Badge variant="warning" dot pulse>{ev.reviewNeeded} Reviews</Badge>,
    processing: <Badge variant="info" dot pulse>Processing</Badge>,
  }[ev.status];

  const handleOpen = () => {
    router.push(`/organization/events/${ev.id}`);
  };

  return (
    <div
      onClick={handleOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleOpen();
        }
      }}
      className="card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-seam-gold/40 hover:bg-surface-50/40 transition-all cursor-pointer group"
    >
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h3 className="font-sans font-medium text-bone group-hover:text-seam-gold transition-colors">{ev.title}</h3>
          {statusBadge}
        </div>
        <p className="font-mono text-[10px] text-ash">
          {ev.date} · {ev.media.toLocaleString()} files · {ev.matches.toLocaleString()} matches
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {ev.status === 'review' && (
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

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function OrganizationDashboard() {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [events, setEvents] = useState<OrgEvent[]>(INITIAL_EVENTS);
  const [reviewSearchQuery, setReviewSearchQuery] = useState('');
  const handleSelectReview = (title: string) => {
    setReviewSearchQuery(title);
    setActiveSection('review');
  };
  const reviewCount = events.reduce((sum, e) => sum + e.reviewNeeded, 0);

  const addEvent = (ev: OrgEvent) => setEvents(prev => [ev, ...prev]);

  const navCounts: Partial<Record<Section, number>> = {
    events: events.length,
    review: reviewCount,
  };

  const sectionContent: Record<Section, React.ReactNode> = {
    overview:  <OverviewSection events={events} onCreateEvent={() => setShowCreateModal(true)} onSelectReview={handleSelectReview} />,
    events:    <EventsSection events={events} onCreateEvent={() => setShowCreateModal(true)} onSelectReview={handleSelectReview} />,
    review:    <ReviewQueueSection initialSearch={reviewSearchQuery} />,
    students:  <StudentsSection />,
    analytics: <AnalyticsSection />,
  };

  return (
    <div className="min-h-dvh flex flex-col bg-basalt">
      <Navbar context="organization" />

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar */}
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

          {/* Sidebar footer */}
          <div className="mt-auto pt-4 border-t border-surface-border">
            <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-md text-ash hover:text-bone hover:bg-surface-50 transition-all font-sans text-sm">
              ← Back to Home
            </Link>
          </div>
        </aside>

        {/* Mobile nav */}
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

        {/* Main Content */}
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

      {/* Create Event Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateEventModal
            onClose={() => setShowCreateModal(false)}
            onCreate={addEvent}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
