'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PhotoGrid, MediaItem } from '@/components/PhotoGrid';
import { EmptyState } from '@/components/ui/Loading';
import { useToast } from '@/components/ui/Toast';
import { Download, FileText, CheckCircle2, ChevronLeft, Search, Image as ImgIcon } from 'lucide-react';
import {
  getRealEventById,
  getRealMediaByEvent,
  RealEvent,
  RealMediaItem,
} from '@/lib/picaxe-store';

export default function StudentEventView() {
  const routeParams = useParams();
  const rawId = routeParams?.id;
  const eventId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : 'evt-1';
  const { toast } = useToast();

  const [event, setEvent] = useState<RealEvent | null>(null);
  const [mediaItems, setMediaItems] = useState<RealMediaItem[]>([]);
  const [viewMode, setViewMode] = useState<'matches' | 'all'>('matches');

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
    setMediaItems(getRealMediaByEvent(eventId));
  };

  useEffect(() => {
    loadData();
    window.addEventListener('picaxe_store_updated', loadData);
    return () => window.removeEventListener('picaxe_store_updated', loadData);
  }, [eventId]);

  const realPhotos = mediaItems.filter(m => m.type === 'photo');
  const realCerts = mediaItems.filter(m => m.type === 'certificate');

  const displayPhotos = viewMode === 'matches' ? realPhotos.filter(p => p.isMatch) : realPhotos;
  const displayCerts = viewMode === 'matches' ? realCerts.filter(c => c.isMatch) : realCerts;
  const matchedCount = realPhotos.filter(p => p.isMatch).length + realCerts.filter(c => c.isMatch).length;

  const photoGridItems: MediaItem[] = displayPhotos.map(p => ({
    id: p.id,
    url: p.url, // Real image data URL
    isMatch: p.isMatch,
    type: p.type,
  }));

  const handleDownloadAll = () => {
    toast({ type: 'success', title: 'Download started', description: `${matchedCount} real matched files preparing...` });
  };

  if (!event) return null;

  return (
    <div className="min-h-dvh flex flex-col bg-basalt">
      <Navbar context="student" />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* Back + search row */}
        <div className="flex items-center justify-between mb-8 gap-4">
          <Link href="/student" className="flex items-center gap-1.5 text-ash hover:text-bone transition-colors font-sans text-sm">
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-2 bg-surface-50 border border-surface-border rounded-md px-3 py-2 w-48 md:w-72 focus-within:border-seam-gold/50 transition-colors">
            <Search className="w-3.5 h-3.5 text-ash shrink-0" />
            <input type="text" placeholder="Search event media..." className="bg-transparent text-sm text-bone font-sans outline-none w-full placeholder-ash/40" aria-label="Search event media" />
          </div>
        </div>

        {/* Event Header */}
        <div className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-sans font-semibold text-4xl md:text-5xl text-bone tracking-tight mb-3">
                {event.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs text-ash">{event.date}</span>
                <span className="text-ash/30">·</span>
                <span className="font-mono text-xs text-ash">{realPhotos.length} photos</span>
                <span className="text-ash/30">·</span>
                <span className="font-mono text-xs text-ash">{realCerts.length} certificates</span>
                {matchedCount > 0 && (
                  <>
                    <span className="text-ash/30">·</span>
                    <Badge variant="success" dot pulse={false}>{matchedCount} AI Matched to You</Badge>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {matchedCount > 0 && (
                <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={handleDownloadAll}>
                  Download Matches
                </Button>
              )}
              {/* Toggle */}
              <div className="flex items-center bg-surface border border-surface-border p-1 rounded-md">
                <button
                  className={`px-3 py-1.5 text-sm font-sans rounded-sm transition-all ${viewMode === 'matches' ? 'bg-basalt text-bone shadow-sm border border-surface-border' : 'text-ash hover:text-bone'}`}
                  onClick={() => setViewMode('matches')}
                  aria-pressed={viewMode === 'matches'}
                >
                  Your Matches ({matchedCount})
                </button>
                <button
                  className={`px-3 py-1.5 text-sm font-sans rounded-sm transition-all ${viewMode === 'all' ? 'bg-basalt text-bone shadow-sm border border-surface-border' : 'text-ash hover:text-bone'}`}
                  onClick={() => setViewMode('all')}
                  aria-pressed={viewMode === 'all'}
                >
                  All Media ({mediaItems.length})
                </button>
              </div>
            </div>
          </div>

          {/* AI confidence summary banner */}
          {viewMode === 'matches' && matchedCount > 0 && (
            <div className="mt-6 p-4 bg-verdigris-muted border border-verdigris/20 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-verdigris shrink-0" />
              <p className="font-sans text-sm text-bone">
                AI matched your registered face to <strong>{matchedCount} items</strong> with optimal confidence.
              </p>
            </div>
          )}
        </div>

        {/* Certificates */}
        <section className="mb-16" aria-label="Certificates">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="font-sans font-semibold text-xl text-bone">Certificates</h2>
            {viewMode === 'matches' && displayCerts.length > 0 && <Badge variant="success" dot>Verified</Badge>}
            <span className="font-mono text-xs text-ash ml-auto">{displayCerts.length} item{displayCerts.length !== 1 ? 's' : ''}</span>
          </div>

          {displayCerts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayCerts.map(cert => (
                <div key={cert.id} className={`card p-5 flex items-center justify-between gap-4 hover:border-ash/25 transition-colors ${cert.isMatch ? 'border-verdigris/25' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-14 bg-basalt border border-surface-border rounded-md flex items-center justify-center text-ash/30 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-sans font-medium text-bone text-sm">{cert.filename}</p>
                      {cert.isMatch ? (
                        <p className="font-mono text-[10px] text-verdigris mt-1">Verified OCR Match · {cert.confidenceScore || 95}% confidence</p>
                      ) : (
                        <p className="font-mono text-[10px] text-ash mt-1">Not matched</p>
                      )}
                    </div>
                  </div>
                  {cert.isMatch && (
                    <a href={cert.url} download={cert.filename} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" icon={<Download className="w-4 h-4" />}>
                        Download
                      </Button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<FileText className="w-6 h-6 text-ash" />}
              title="No certificates in this event"
              description="Uploaded certificates will appear here once processed."
            />
          )}
        </section>

        {/* Real Photos */}
        <section aria-label="Event photos">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="font-sans font-semibold text-xl text-bone">Photos</h2>
            {viewMode === 'matches' && displayPhotos.length > 0 && <Badge variant="success" dot>Verified</Badge>}
            <span className="font-mono text-xs text-ash ml-auto">{displayPhotos.length} item{displayPhotos.length !== 1 ? 's' : ''}</span>
          </div>

          {displayPhotos.length > 0 ? (
            <PhotoGrid items={photoGridItems} />
          ) : (
            <EmptyState
              icon={<ImgIcon className="w-6 h-6 text-ash" />}
              title={viewMode === 'matches' ? 'No matched photos yet' : 'No photos in this event yet'}
              description={viewMode === 'matches' ? "We couldn't detect your registered face in these photos yet." : 'Upload event photos to view them in the gallery.'}
              action={viewMode === 'matches' && realPhotos.length > 0 ? (
                <Button variant="secondary" size="sm" onClick={() => setViewMode('all')}>Browse All Photos ({realPhotos.length})</Button>
              ) : undefined}
            />
          )}
        </section>
      </main>
    </div>
  );
}
