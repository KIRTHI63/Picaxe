'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PhotoGrid, MediaItem } from '@/components/PhotoGrid';
import { UploadZone } from '@/components/UploadZone';
import { EmptyState } from '@/components/ui/Loading';
import { useToast } from '@/components/ui/Toast';
import {
  ChevronLeft, UploadCloud, Download, CheckCircle2,
  Search, Users, Image as ImgIcon, Check, X
} from 'lucide-react';
import {
  getRealEventById,
  getRealMediaByEvent,
  getRealStudentProfile,
  approveReview,
  rejectReview,
  RealEvent,
  RealMediaItem,
} from '@/lib/picaxe-store';

export default function OrgEventView() {
  const routeParams = useParams();
  const rawId = routeParams?.id;
  const eventId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : 'evt-1';
  const { toast } = useToast();

  const [event, setEvent] = useState<RealEvent | null>(null);
  const [mediaItems, setMediaItems] = useState<RealMediaItem[]>([]);
  const [activeTab, setActiveTab] = useState<'media' | 'students' | 'upload' | 'review'>('media');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'matches'>('all');
  const [studentSearch, setStudentSearch] = useState('');

  const loadData = () => {
    const foundEvent = getRealEventById(eventId) || {
      id: eventId,
      title: eventId === 'evt-1' ? 'Engineering Hackathon' : eventId === 'evt-2' ? 'Alumni Dinner 2026' : `Event ${eventId}`,
      date: 'Active',
      description: 'Event photo gallery & biometric identification workspace.',
      mediaCount: 0,
      matchCount: 0,
      reviewNeeded: 0,
      status: 'done' as const,
      createdAt: new Date().toISOString(),
    };
    setEvent(foundEvent);
    const media = getRealMediaByEvent(eventId);
    setMediaItems(media);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('picaxe_store_updated', loadData);
    return () => window.removeEventListener('picaxe_store_updated', loadData);
  }, [eventId]);

  const student = getRealStudentProfile();
  const matchedPhotos = mediaItems.filter(m => m.isMatch);
  const reviewItems = mediaItems.filter(m => m.needsReview);

  // Convert real media items to PhotoGrid format
  const photoGridItems: MediaItem[] = (
    mediaFilter === 'matches' ? matchedPhotos : mediaItems
  ).map(m => ({
    id: m.id,
    url: m.url, // Real image data URL
    isMatch: m.isMatch,
    type: m.type,
  }));

  const handleApprove = (id: string, name: string) => {
    approveReview(id);
    loadData();
    toast({ type: 'success', title: 'Match verified', description: `Confirmed match for ${name}.` });
  };

  const handleReject = (id: string) => {
    rejectReview(id);
    loadData();
    toast({ type: 'info', title: 'Match removed', description: 'Photo excluded from student gallery.' });
  };

  if (!event) return null;

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
            {event.reviewNeeded > 0 ? (
              <Badge variant="warning" dot pulse>{event.reviewNeeded} Reviews Needed</Badge>
            ) : (
              <Badge variant="success" dot>Active</Badge>
            )}
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
                {event.description || 'Event photo repository and biometric student identification console.'}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs text-ash">{event.date}</span>
                <span className="text-ash/30">·</span>
                <span className="font-mono text-xs text-ash">{mediaItems.length} actual uploaded files</span>
                <span className="text-ash/30">·</span>
                <span className="font-mono text-xs text-ash">{matchedPhotos.length} matched files</span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="primary"
                size="sm"
                icon={<UploadCloud className="w-4 h-4" />}
                onClick={() => setActiveTab('upload')}
              >
                Upload Media
              </Button>
            </div>
          </div>
        </div>

        {/* Stat Highlights - Real Counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card p-5">
            <p className="font-sans font-semibold text-2xl text-bone mb-1">{mediaItems.length}</p>
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide">Real Uploaded Files</p>
          </div>
          <div className="card p-5">
            <p className="font-sans font-semibold text-2xl text-bone mb-1">{matchedPhotos.length}</p>
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide">AI Matches Identified</p>
          </div>
          <div className="card p-5">
            <p className="font-sans font-semibold text-2xl text-bone mb-1">{reviewItems.length}</p>
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide">Pending Reviews</p>
          </div>
          <div className="card p-5">
            <p className="font-sans font-semibold text-2xl text-bone mb-1">
              {mediaItems.length > 0 ? `${Math.round((matchedPhotos.length / mediaItems.length) * 100)}%` : '0%'}
            </p>
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide">Match Rate</p>
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
            Media Gallery ({mediaItems.length})
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-1.5 text-xs font-sans rounded-sm transition-all ${
              activeTab === 'students' ? 'bg-basalt text-bone border border-surface-border font-medium' : 'text-ash hover:text-bone'
            }`}
          >
            Matched Students ({matchedPhotos.length > 0 ? 1 : 0})
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-1.5 text-xs font-sans rounded-sm transition-all ${
              activeTab === 'upload' ? 'bg-basalt text-bone border border-surface-border font-medium' : 'text-ash hover:text-bone'
            }`}
          >
            Upload Real Media
          </button>
          {reviewItems.length > 0 && (
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

        {/* Tab 1: Real Media Gallery */}
        {activeTab === 'media' && (
          <div className="flex flex-col gap-6">
            {mediaItems.length > 0 ? (
              <>
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
                      All Real Photos ({mediaItems.length})
                    </button>
                    <button
                      onClick={() => setMediaFilter('matches')}
                      className={`px-3 py-1 text-xs rounded border transition-colors ${
                        mediaFilter === 'matches'
                          ? 'bg-surface-50 text-bone border-seam-gold/50'
                          : 'text-ash border-surface-border hover:text-bone'
                      }`}
                    >
                      AI Matched ({matchedPhotos.length})
                    </button>
                  </div>
                  <span className="font-mono text-xs text-ash">
                    Real File Previews & Match Highlights
                  </span>
                </div>

                <PhotoGrid items={photoGridItems} />
              </>
            ) : (
              <EmptyState
                icon={<ImgIcon className="w-8 h-8 text-ash" />}
                title="No media uploaded yet"
                description="Upload real event photos or certificates to view them in the gallery and run AI biometric matching."
                action={
                  <Button variant="primary" size="sm" icon={<UploadCloud className="w-4 h-4" />} onClick={() => setActiveTab('upload')}>
                    Upload Photos Now
                  </Button>
                }
              />
            )}
          </div>
        )}

        {/* Tab 2: Matched Students Roster */}
        {activeTab === 'students' && (
          <div className="flex flex-col gap-6">
            {matchedPhotos.length > 0 ? (
              <div className="card divide-y divide-surface-border overflow-hidden">
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-surface-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-seam-gold/20 border border-seam-gold/30 flex items-center justify-center font-mono text-xs font-semibold text-seam-gold overflow-hidden">
                      {student.registeredFaceUrl ? (
                        <img src={student.registeredFaceUrl} alt={student.name} className="w-full h-full object-cover" />
                      ) : (
                        student.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-sans font-medium text-bone text-sm">{student.name}</p>
                        <Badge variant="success">Verified Match</Badge>
                      </div>
                      <p className="font-mono text-[10px] text-ash">{student.email} · {student.rollNumber}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-sans font-medium text-bone text-sm">{matchedPhotos.length} photos matched</p>
                      <p className="font-mono text-[10px] text-ash">Active in this event</p>
                    </div>
                    <div className="w-24 text-right">
                      <span className="font-mono text-xs text-seam-gold font-medium">96%</span>
                      <p className="font-mono text-[9px] text-ash uppercase">Avg Confidence</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<Users className="w-8 h-8 text-ash" />}
                title="No matched students yet"
                description="Upload event photos with student faces to match them against registered student profiles."
                action={
                  <Button variant="primary" size="sm" icon={<UploadCloud className="w-4 h-4" />} onClick={() => setActiveTab('upload')}>
                    Upload Photos Now
                  </Button>
                }
              />
            )}
          </div>
        )}

        {/* Tab 3: Upload Real Media */}
        {activeTab === 'upload' && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="font-sans font-semibold text-xl text-bone mb-1">Upload Real Photos & Certificates</h2>
              <p className="font-sans text-sm text-ash">
                Drop your original photos or certificates here. They will be stored and matched to registered student biometrics.
              </p>
            </div>
            <UploadZone
              eventId={event.id}
              onComplete={count => {
                loadData();
                setActiveTab('media');
                toast({
                  type: 'success',
                  title: 'Upload complete',
                  description: `${count} photos processed and stored in this event gallery.`,
                });
              }}
            />
          </div>
        )}

        {/* Tab 4: Review Queue */}
        {activeTab === 'review' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-sans font-semibold text-xl text-bone">Review Flagged Matches</h2>
                <p className="font-sans text-sm text-ash">
                  Items requiring human review for confidence confirmation.
                </p>
              </div>
              <Badge variant="warning">{reviewItems.length} Pending</Badge>
            </div>

            {reviewItems.length > 0 ? (
              <div className="flex flex-col gap-3">
                {reviewItems.map(r => (
                  <div key={r.id} className="card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-basalt border border-surface-border rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
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
                        <p className="font-mono text-[10px] text-ash">{r.filename}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="font-mono text-[10px] text-ash">{r.confidenceScore}% confidence</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Check className="w-4 h-4 text-verdigris" />}
                        onClick={() => handleApprove(r.id, r.matchedStudentName || 'Student')}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<X className="w-4 h-4 text-danger" />}
                        onClick={() => handleReject(r.id)}
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
                title="Review Queue Cleared"
                description="No items currently require human review."
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
