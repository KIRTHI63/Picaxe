'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PhotoGrid, MediaItem } from '@/components/PhotoGrid';
import { UploadZone } from '@/components/UploadZone';
import { EmptyState } from '@/components/ui/Loading';
import { useToast } from '@/components/ui/Toast';
import {
  ChevronLeft, UploadCloud, Download, CheckCircle2, AlertCircle,
  Search, Users, Image as ImgIcon, FileText, Check, X, Sparkles, Filter
} from 'lucide-react';

interface EventDetails {
  id: string;
  title: string;
  date: string;
  media: number;
  matches: number;
  reviewNeeded: number;
  status: 'done' | 'review' | 'processing';
  description: string;
}

const EVENTS_DATA: Record<string, EventDetails> = {
  'evt-1': {
    id: 'evt-1',
    title: 'Engineering Hackathon',
    date: 'Yesterday',
    media: 1450,
    matches: 890,
    reviewNeeded: 0,
    status: 'done',
    description: 'Annual 36-hour hackathon with student teams, live coding, and sponsor awards.',
  },
  'evt-2': {
    id: 'evt-2',
    title: 'Alumni Dinner 2026',
    date: '3 days ago',
    media: 320,
    matches: 210,
    reviewNeeded: 12,
    status: 'review',
    description: 'Evening gala and networking dinner welcoming alumni from past graduating batches.',
  },
  'evt-3': {
    id: 'evt-3',
    title: 'Convocation 2026',
    date: 'Processing...',
    media: 4200,
    matches: 0,
    reviewNeeded: 0,
    status: 'processing',
    description: 'Formal university graduation and degree conferral ceremony.',
  },
};

const MATCHED_STUDENTS = [
  { id: 's1', name: 'Kirthivasan', email: 'kirthi@university.edu', photos: 14, certs: 2, confidence: 98, status: 'Verified' },
  { id: 's2', name: 'John Doe', email: 'john@university.edu', photos: 20, certs: 1, confidence: 95, status: 'Verified' },
  { id: 's3', name: 'Jane Smith', email: 'jane@university.edu', photos: 16, certs: 1, confidence: 92, status: 'Verified' },
  { id: 's4', name: 'Alex Johnson', email: 'alex@university.edu', photos: 11, certs: 0, confidence: 88, status: 'Verified' },
  { id: 's5', name: 'Maria Garcia', email: 'maria@university.edu', photos: 8, certs: 1, confidence: 71, status: 'Review Needed' },
];

export default function OrgEventView() {
  const routeParams = useParams();
  const rawId = routeParams?.id;
  const eventId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : 'evt-1';
  const { toast } = useToast();
  const event = EVENTS_DATA[eventId] || {
    id: eventId,
    title: `Event ${eventId}`,
    date: 'Recent',
    media: 120,
    matches: 85,
    reviewNeeded: 0,
    status: 'done' as const,
    description: 'Custom organization event gallery and biometric matching workspace.',
  };

  const [activeTab, setActiveTab] = useState<'media' | 'students' | 'upload' | 'review'>('media');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'matches'>('all');
  const [studentSearch, setStudentSearch] = useState('');
  const [reviewItems, setReviewItems] = useState([
    { id: 'r1', photo: 'photo_824.jpg', student: 'John Doe', confidence: 71, reason: 'Low face confidence' },
    { id: 'r2', photo: 'photo_825.jpg', student: 'Jane Smith', confidence: 68, reason: 'Partial occlusion / angle' },
    { id: 'r3', photo: 'group_shot_01.jpg', student: 'Alex Johnson', confidence: 75, reason: 'Multiple faces in frame' },
  ]);

  const mockPhotos: MediaItem[] = Array.from({ length: 24 }).map((_, i) => ({
    id: `photo-${i}`,
    url: '',
    isMatch: [1, 2, 4, 7, 10, 14, 18, 21].includes(i),
    type: 'photo',
  }));

  const filteredStudents = MATCHED_STUDENTS.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const handleApproveReview = (id: string, student: string) => {
    setReviewItems(prev => prev.filter(r => r.id !== id));
    toast({ type: 'success', title: 'Match verified', description: `Confirmed match for ${student}.` });
  };

  const handleRejectReview = (id: string) => {
    setReviewItems(prev => prev.filter(r => r.id !== id));
    toast({ type: 'info', title: 'Match removed', description: 'Photo excluded from student collection.' });
  };

  return (
    <div className="min-h-dvh flex flex-col bg-basalt">
      <Navbar context="organization" />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* Navigation / Breadcrumb */}
        <div className="flex items-center justify-between mb-8 gap-4">
          <Link
            href="/organization"
            className="flex items-center gap-1.5 text-ash hover:text-bone transition-colors font-sans text-sm"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            {event.status === 'done' && <Badge variant="success" dot>Processed</Badge>}
            {event.status === 'review' && <Badge variant="warning" dot pulse>{event.reviewNeeded} Reviews Needed</Badge>}
            {event.status === 'processing' && <Badge variant="info" dot pulse>Processing</Badge>}
          </div>
        </div>

        {/* Event Header */}
        <div className="mb-10 pb-8 border-b border-surface-border">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-sans font-semibold text-3xl md:text-4xl text-bone tracking-tight mb-2">
                {event.title}
              </h1>
              <p className="font-sans text-sm text-ash max-w-2xl mb-4">
                {event.description}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs text-ash">{event.date}</span>
                <span className="text-ash/30">·</span>
                <span className="font-mono text-xs text-ash">{event.media.toLocaleString()} total files</span>
                <span className="text-ash/30">·</span>
                <span className="font-mono text-xs text-ash">{event.matches.toLocaleString()} matched students</span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                icon={<UploadCloud className="w-4 h-4" />}
                onClick={() => setActiveTab('upload')}
              >
                Upload Media
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Download className="w-4 h-4" />}
                onClick={() => toast({ type: 'success', title: 'Exporting report', description: `${event.title} match roster downloaded.` })}
              >
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Stat Highlights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card p-5">
            <p className="font-sans font-semibold text-2xl text-bone mb-1">{event.media.toLocaleString()}</p>
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide">Total Media Uploaded</p>
          </div>
          <div className="card p-5">
            <p className="font-sans font-semibold text-2xl text-bone mb-1">{event.matches.toLocaleString()}</p>
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide">Students Matched</p>
          </div>
          <div className="card p-5">
            <p className="font-sans font-semibold text-2xl text-bone mb-1">{event.reviewNeeded}</p>
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide">Pending Reviews</p>
          </div>
          <div className="card p-5">
            <p className="font-sans font-semibold text-2xl text-bone mb-1">94.8%</p>
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide">AI Match Accuracy</p>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 bg-surface border border-surface-border p-1 rounded-md mb-8 w-fit">
          <button
            onClick={() => setActiveTab('media')}
            className={`px-4 py-1.5 text-xs font-sans rounded-sm transition-all ${
              activeTab === 'media' ? 'bg-basalt text-bone border border-surface-border font-medium' : 'text-ash hover:text-bone'
            }`}
          >
            Media Gallery ({mockPhotos.length})
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-1.5 text-xs font-sans rounded-sm transition-all ${
              activeTab === 'students' ? 'bg-basalt text-bone border border-surface-border font-medium' : 'text-ash hover:text-bone'
            }`}
          >
            Matched Students ({MATCHED_STUDENTS.length})
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-1.5 text-xs font-sans rounded-sm transition-all ${
              activeTab === 'upload' ? 'bg-basalt text-bone border border-surface-border font-medium' : 'text-ash hover:text-bone'
            }`}
          >
            Upload Media
          </button>
          {event.reviewNeeded > 0 && (
            <button
              onClick={() => setActiveTab('review')}
              className={`px-4 py-1.5 text-xs font-sans rounded-sm transition-all flex items-center gap-1.5 ${
                activeTab === 'review' ? 'bg-basalt text-bone border border-surface-border font-medium' : 'text-ash hover:text-bone'
              }`}
            >
              <span>Review Queue</span>
              <span className="font-mono text-[9px] bg-seam-gold/20 text-seam-gold px-1.5 py-0.2 rounded-full border border-seam-gold/30">
                {reviewItems.length}
              </span>
            </button>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'media' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMediaFilter('all')}
                  className={`px-3 py-1 text-xs rounded border transition-colors ${
                    mediaFilter === 'all'
                      ? 'bg-surface-50 text-bone border-seam-gold/50'
                      : 'text-ash border-surface-border hover:text-bone'
                  }`}
                >
                  All Photos ({mockPhotos.length})
                </button>
                <button
                  onClick={() => setMediaFilter('matches')}
                  className={`px-3 py-1 text-xs rounded border transition-colors ${
                    mediaFilter === 'matches'
                      ? 'bg-surface-50 text-bone border-seam-gold/50'
                      : 'text-ash border-surface-border hover:text-bone'
                  }`}
                >
                  AI Matched ({mockPhotos.filter(p => p.isMatch).length})
                </button>
              </div>

              <span className="font-mono text-xs text-ash">
                RetinaFace + ArcFace 512D · Qdrant Vector Index
              </span>
            </div>

            <PhotoGrid
              items={mediaFilter === 'matches' ? mockPhotos.filter(p => p.isMatch) : mockPhotos}
            />
          </div>
        )}

        {activeTab === 'students' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 bg-surface border border-surface-border rounded-md px-3 py-2 w-full max-w-sm focus-within:border-seam-gold/50 transition-colors">
                <Search className="w-3.5 h-3.5 text-ash shrink-0" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  placeholder="Search matched student by name or email..."
                  className="bg-transparent text-sm text-bone font-sans outline-none w-full placeholder-ash/40"
                />
              </div>
              <span className="font-mono text-xs text-ash">{filteredStudents.length} students detected</span>
            </div>

            <div className="card divide-y divide-surface-border overflow-hidden">
              {filteredStudents.map(s => (
                <div key={s.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-surface-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-basalt border border-surface-border flex items-center justify-center font-mono text-xs font-semibold text-bone">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-sans font-medium text-bone text-sm">{s.name}</p>
                        {s.status === 'Verified' ? (
                          <Badge variant="success">Verified</Badge>
                        ) : (
                          <Badge variant="warning">Review</Badge>
                        )}
                      </div>
                      <p className="font-mono text-[10px] text-ash">{s.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-sans font-medium text-bone text-sm">{s.photos} photos</p>
                      <p className="font-mono text-[10px] text-ash">{s.certs} certificates</p>
                    </div>
                    <div className="w-24 text-right">
                      <span className="font-mono text-xs text-seam-gold font-medium">{s.confidence}%</span>
                      <p className="font-mono text-[9px] text-ash uppercase">Confidence</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-sans font-semibold text-xl text-bone mb-1">Upload Event Photos & Certificates</h2>
              <p className="font-sans text-sm text-ash">
                Drop your batch files here. Our Face & NLP Engines will process and match them immediately.
              </p>
            </div>
            <UploadZone
              onComplete={count => {
                toast({
                  type: 'success',
                  title: 'Upload & processing complete',
                  description: `${count} student matches identified and tagged.`,
                });
              }}
            />
          </div>
        )}

        {activeTab === 'review' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-sans font-semibold text-xl text-bone">Review Flagged Matches</h2>
                <p className="font-sans text-sm text-ash">
                  Items below confidence threshold or with multiple faces require human confirmation.
                </p>
              </div>
              <Badge variant="warning">{reviewItems.length} Pending</Badge>
            </div>

            {reviewItems.length > 0 ? (
              <div className="flex flex-col gap-3">
                {reviewItems.map(r => (
                  <div key={r.id} className="card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-basalt border border-surface-border rounded-lg flex items-center justify-center shrink-0">
                        <ImgIcon className="w-5 h-5 text-ash/40" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-sans font-medium text-bone text-sm">{r.student}</p>
                          <Badge variant="warning">{r.reason}</Badge>
                        </div>
                        <p className="font-mono text-[10px] text-ash">{r.photo}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="h-1 w-24 bg-basalt rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-seam-gold" style={{ width: `${r.confidence}%` }} />
                          </div>
                          <span className="font-mono text-[10px] text-ash">{r.confidence}% confidence</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Check className="w-4 h-4 text-verdigris" />}
                        onClick={() => handleApproveReview(r.id, r.student)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<X className="w-4 h-4 text-danger" />}
                        onClick={() => handleRejectReview(r.id)}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<CheckCircle2 className="w-6 h-6 text-verdigris" />}
                title="Review Queue Cleared"
                description="All AI matches for this event have been verified."
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
