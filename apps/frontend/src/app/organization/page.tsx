'use client';
import React, { useState, useEffect } from 'react';
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
  Activity, Calendar, ChevronRight, X, Search,
  Image as ImgIcon, TrendingUp, Check
} from 'lucide-react';
import {
  getRealEvents,
  createRealEvent,
  getAllRealMedia,
  getReviewQueueItems,
  getRealStudentProfile,
  approveReview,
  rejectReview,
  RealEvent,
  RealMediaItem,
} from '@/lib/picaxe-store';

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
  onCreate: (event: RealEvent) => void;
}

function CreateEventModal({ onClose, onCreate }: CreateEventModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);

    try {
      const newEvent = createRealEvent({
        title: title.trim(),
        date: date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        description: description.trim(),
      });
      onCreate(newEvent);
      toast({ type: 'success', title: 'Event created', description: `"${newEvent.title}" is ready for media uploads.` });
      onClose();
    } finally {
      setLoading(false);
    }
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
              value={description}
              onChange={e => setDescription(e.target.value)}
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

function OverviewSection({
  events,
  onCreateEvent,
  onSelectReview
}: {
  events: RealEvent[];
  onCreateEvent: () => void;
  onSelectReview?: (title: string) => void;
}) {
  const { toast } = useToast();
  const allMedia = getAllRealMedia();
  const matchedCount = allMedia.filter(m => m.isMatch).length;
  const matchRate = allMedia.length > 0 ? `${Math.round((matchedCount / allMedia.length) * 100)}%` : '0%';

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-sans font-semibold text-2xl text-bone">Overview</h1>
        <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={onCreateEvent}>
          Create Event
        </Button>
      </div>

      {/* Stats - 100% Real Numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: String(events.length) },
          { label: 'Real Media Uploaded', value: String(allMedia.length) },
          { label: 'Matches Identified', value: String(matchedCount) },
          { label: 'Match Rate', value: matchRate },
        ].map(s => (
          <div key={s.label} className="card p-5">
            <p className="font-sans font-semibold text-2xl text-bone mb-1">{s.value}</p>
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Upload Zone */}
      <section>
        <h2 className="font-sans font-semibold text-lg text-bone mb-4">Upload Event Media</h2>
        <UploadZone
          onComplete={count => {
            toast({ type: 'success', title: 'Upload complete', description: `${count} photos processed and stored.` });
          }}
        />
      </section>

      {/* Recent Events */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-sans font-semibold text-lg text-bone">Events</h2>
        </div>
        {events.length > 0 ? (
          <div className="flex flex-col gap-3">
            {events.map(ev => <OrgEventRow key={ev.id} ev={ev} onSelectReview={onSelectReview} />)}
          </div>
        ) : (
          <EmptyState
            icon={<Calendar className="w-8 h-8 text-ash" />}
            title="No events yet"
            description="Create your first organization event to start uploading media and matching students."
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
  onSelectReview
}: {
  events: RealEvent[];
  onCreateEvent: () => void;
  onSelectReview?: (title: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'done' | 'review'>('all');
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
      </div>

      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map(ev => <OrgEventRow key={ev.id} ev={ev} onSelectReview={onSelectReview} />)}
        </div>
      ) : (
        <EmptyState
          icon={<Calendar className="w-8 h-8 text-ash" />}
          title="No events found"
          description={events.length === 0 ? "You haven't created any events yet." : "No events matched your search query."}
          action={<Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={onCreateEvent}>Create Event</Button>}
        />
      )}
    </div>
  );
}

function ReviewQueueSection({ initialSearch = '' }: { initialSearch?: string }) {
  const { toast } = useToast();
  const [items, setItems] = useState<RealMediaItem[]>([]);
  const [search, setSearch] = useState(initialSearch);

  const loadItems = () => {
    setItems(getReviewQueueItems());
  };

  useEffect(() => {
    loadItems();
    window.addEventListener('picaxe_store_updated', loadItems);
    return () => window.removeEventListener('picaxe_store_updated', loadItems);
  }, []);

  const filtered = items.filter(r =>
    (r.matchedStudentName || '').toLowerCase().includes(search.toLowerCase()) ||
    r.eventName.toLowerCase().includes(search.toLowerCase()) ||
    r.filename.toLowerCase().includes(search.toLowerCase())
  );

  const handleApprove = (id: string, name: string) => {
    approveReview(id);
    loadItems();
    toast({ type: 'success', title: 'Match approved', description: `Verified match for ${name}.` });
  };

  const handleReject = (id: string) => {
    rejectReview(id);
    loadItems();
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
        {items.length > 0 && <Badge variant="warning" dot pulse>{items.length} Pending</Badge>}
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
                <div className="w-14 h-14 bg-basalt border border-surface-border rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                  {r.url ? (
                    <img src={r.url} alt={r.filename} className="w-full h-full object-cover" />
                  ) : (
                    <ImgIcon className="w-5 h-5 text-ash/40" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-sans font-medium text-bone text-sm">{r.matchedStudentName || 'Student'}</p>
                    <Badge variant="warning">{r.reviewReason || 'Review Needed'}</Badge>
                  </div>
                  <p className="font-mono text-[10px] text-ash">{r.filename} · {r.eventName}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="font-mono text-[10px] text-ash">{r.confidenceScore}% confidence</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="secondary" size="sm" icon={<Check className="w-4 h-4 text-verdigris" />} onClick={() => handleApprove(r.id, r.matchedStudentName || 'Student')}>
                  Approve
                </Button>
                <Button variant="ghost" size="sm" icon={<X className="w-4 h-4 text-danger" />} onClick={() => handleReject(r.id)}>
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
          description="All real media uploaded has been processed and verified. No human reviews needed."
        />
      )}
    </div>
  );
}

function StudentsSection() {
  const student = getRealStudentProfile();
  const allMedia = getAllRealMedia();
  const matchedPhotos = allMedia.filter(m => m.isMatch).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-sans font-semibold text-2xl text-bone">Registered Students</h1>
        <p className="font-mono text-[10px] text-ash mt-1 uppercase tracking-wide">
          1 verified student profile enrolled in biometric recognition
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-seam-gold/20 border border-seam-gold/30 flex items-center justify-center font-mono font-semibold text-seam-gold text-base overflow-hidden">
              {student.registeredFaceUrl ? (
                <img src={student.registeredFaceUrl} alt={student.name} className="w-full h-full object-cover" />
              ) : (
                student.name.charAt(0)
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-sans font-medium text-bone text-base">{student.name}</h3>
                {student.isFaceRegistered ? (
                  <Badge variant="success" dot>Face Registered</Badge>
                ) : (
                  <Badge variant="warning">Face Not Registered</Badge>
                )}
              </div>
              <p className="font-mono text-xs text-ash">{student.email} · {student.rollNumber} · {student.department}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="font-sans font-semibold text-bone text-lg">{matchedPhotos}</p>
              <p className="font-mono text-[10px] text-ash uppercase">Matched Photos</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsSection() {
  const events = getRealEvents();
  const allMedia = getAllRealMedia();
  const matched = allMedia.filter(m => m.isMatch).length;
  const matchRate = allMedia.length > 0 ? `${Math.round((matched / allMedia.length) * 100)}%` : '0%';

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-sans font-semibold text-2xl text-bone">Real Analytics</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: String(events.length) },
          { label: 'Media Files Stored', value: String(allMedia.length) },
          { label: 'AI Matches Verified', value: String(matched) },
          { label: 'Overall Match Rate', value: matchRate },
        ].map(m => (
          <div key={m.label} className="card p-5">
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide mb-3">{m.label}</p>
            <p className="font-sans font-semibold text-2xl text-bone">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="font-sans font-semibold text-lg text-bone mb-3">Live System Status</h2>
        <p className="font-sans text-sm text-ash mb-4">
          Metrics are generated live from actual uploaded event files and registered biometric embeddings.
        </p>
        <div className="flex items-center gap-3">
          <Badge variant="success" dot>Face Engine Online</Badge>
          <Badge variant="success" dot>NLP Engine Online</Badge>
          <Badge variant="info">Local Storage Persistent</Badge>
        </div>
      </div>
    </div>
  );
}

// ─── Event Row ────────────────────────────────────────────────────────────────

function OrgEventRow({ ev, onSelectReview }: { ev: RealEvent; onSelectReview?: (eventTitle: string) => void }) {
  const router = useRouter();

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
          {ev.reviewNeeded > 0 ? (
            <Badge variant="warning" dot pulse>{ev.reviewNeeded} Reviews</Badge>
          ) : (
            <Badge variant="success" dot>Active</Badge>
          )}
        </div>
        <p className="font-mono text-[10px] text-ash">
          {ev.date} · {ev.mediaCount} real files · {ev.matchCount} matches
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

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function OrganizationDashboard() {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [events, setEvents] = useState<RealEvent[]>([]);
  const [reviewSearchQuery, setReviewSearchQuery] = useState('');

  const loadEvents = () => {
    const list = getRealEvents();
    setEvents(list);
  };

  useEffect(() => {
    loadEvents();
    window.addEventListener('picaxe_store_updated', loadEvents);
    return () => window.removeEventListener('picaxe_store_updated', loadEvents);
  }, []);

  const handleSelectReview = (title: string) => {
    setReviewSearchQuery(title);
    setActiveSection('review');
  };

  const reviewCount = events.reduce((sum, e) => sum + e.reviewNeeded, 0);

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
            onCreate={ev => {
              setEvents(prev => [ev, ...prev]);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
