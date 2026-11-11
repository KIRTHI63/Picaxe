'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PhotoGrid, MediaItem } from '@/components/PhotoGrid';
import { EmptyState, PhotoGridSkeleton } from '@/components/ui/Loading';
import { Download, FileText, CheckCircle2, ChevronLeft, Image as ImgIcon, AlertCircle } from 'lucide-react';
import { api, EventRecord, MediaAssetRecord, StudentProfileData } from '@/lib/api';

export default function StudentEventView() {
  const routeParams = useParams();
  const rawId = routeParams?.id;
  const eventId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [mediaAssets, setMediaAssets] = useState<MediaAssetRecord[]>([]);
  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [viewMode, setViewMode] = useState<'matches' | 'all'>('matches');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [ev, media, p] = await Promise.all([
        api.events.getById(eventId),
        api.media.getEventMedia(eventId),
        api.students.getMyProfile(),
      ]);
      setEvent(ev);
      setMediaAssets(media);
      setProfile(p);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col bg-basalt">
        <Navbar context="student" />
        <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-12">
          <PhotoGridSkeleton count={8} />
        </main>
      </div>
    );
  }

  if (errorMsg || !event || !profile) {
    return (
      <div className="min-h-dvh flex flex-col bg-basalt">
        <Navbar context="student" />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="card p-8 max-w-md text-center flex flex-col items-center gap-4">
            <AlertCircle className="w-8 h-8 text-danger" />
            <h1 className="font-sans font-semibold text-xl text-bone">Could Not Load Event</h1>
            <p className="font-sans text-sm text-ash">{errorMsg || 'Event not found'}</p>
            <Link href="/student"><Button variant="secondary" size="sm">Back to Dashboard</Button></Link>
          </div>
        </main>
      </div>
    );
  }

  const photos = mediaAssets.filter(m => m.type === 'PHOTO');
  const certs = mediaAssets.filter(m => m.type === 'CERTIFICATE');

  const isMyPhoto = (asset: MediaAssetRecord) =>
    Boolean(asset.photoTags?.some(t => t.studentProfileId === profile.id && t.status !== 'REJECTED'));
  const isMyCert = (asset: MediaAssetRecord) =>
    Boolean(asset.certificateTags?.some(t => t.studentProfileId === profile.id && t.status !== 'REJECTED'));

  const displayPhotos = viewMode === 'matches' ? photos.filter(isMyPhoto) : photos;
  const displayCerts = viewMode === 'matches' ? certs.filter(isMyCert) : certs;
  const matchedCount = photos.filter(isMyPhoto).length + certs.filter(isMyCert).length;

  const photoGridItems: MediaItem[] = displayPhotos.map(p => ({
    id: p.id,
    url: p.publicUrl,
    isMatch: isMyPhoto(p),
    type: 'photo',
  }));

  return (
    <div className="min-h-dvh flex flex-col bg-basalt">
      <Navbar context="student" />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="flex items-center justify-between mb-8 gap-4">
          <Link href="/student" className="flex items-center gap-1.5 text-ash hover:text-bone transition-colors font-sans text-sm">
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </Link>
        </div>

        <div className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-sans font-semibold text-4xl md:text-5xl text-bone tracking-tight mb-3">
                {event.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-ash">
                <span>{new Date(event.startDate).toLocaleDateString()}</span>
                <span>·</span>
                <span>{photos.length} photos</span>
                <span>·</span>
                <span>{certs.length} certificates</span>
                {matchedCount > 0 && (
                  <>
                    <span>·</span>
                    <Badge variant="success" dot pulse={false}>{matchedCount} AI Matched to You</Badge>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center bg-surface border border-surface-border p-1 rounded-md">
              <button
                className={`px-3 py-1.5 text-sm font-sans rounded-sm transition-all ${viewMode === 'matches' ? 'bg-basalt text-bone shadow-sm border border-surface-border' : 'text-ash hover:text-bone'}`}
                onClick={() => setViewMode('matches')}
              >
                Your Matches ({matchedCount})
              </button>
              <button
                className={`px-3 py-1.5 text-sm font-sans rounded-sm transition-all ${viewMode === 'all' ? 'bg-basalt text-bone shadow-sm border border-surface-border' : 'text-ash hover:text-bone'}`}
                onClick={() => setViewMode('all')}
              >
                All Media ({mediaAssets.length})
              </button>
            </div>
          </div>

          {viewMode === 'matches' && matchedCount > 0 && (
            <div className="mt-6 p-4 bg-verdigris-muted border border-verdigris/20 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-verdigris shrink-0" />
              <p className="font-sans text-sm text-bone">
                AI matched your profile to <strong>{matchedCount} item(s)</strong> in this event.
              </p>
            </div>
          )}
        </div>

        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="font-sans font-semibold text-xl text-bone">Certificates</h2>
            <span className="font-mono text-xs text-ash ml-auto">{displayCerts.length} item(s)</span>
          </div>
          {displayCerts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayCerts.map(cert => {
                const tag = cert.certificateTags?.find(t => t.studentProfileId === profile.id && t.status !== 'REJECTED');
                return (
                  <div key={cert.id} className={`card p-5 flex items-center justify-between gap-4 ${tag ? 'border-verdigris/25' : ''}`}>
                    <div className="flex items-center gap-4">
                      <FileText className="w-5 h-5 text-ash shrink-0" />
                      <div>
                        <p className="font-sans font-medium text-bone text-sm">{cert.originalFilename}</p>
                        {tag ? (
                          <p className="font-mono text-[10px] text-verdigris mt-1">
                            OCR Match (&ldquo;{tag.extractedName}&rdquo;) · {Math.round(tag.confidenceScore * 100)}%
                          </p>
                        ) : (
                          <p className="font-mono text-[10px] text-ash mt-1">Not matched to you</p>
                        )}
                      </div>
                    </div>
                    <a href={cert.publicUrl} download={cert.originalFilename} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" icon={<Download className="w-4 h-4" />}>Download</Button>
                    </a>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={<FileText className="w-6 h-6" />} title="No certificates" description="No certificates found for this filter." />
          )}
        </section>

        <section>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="font-sans font-semibold text-xl text-bone">Photos</h2>
            <span className="font-mono text-xs text-ash ml-auto">{displayPhotos.length} item(s)</span>
          </div>
          {displayPhotos.length > 0 ? (
            <PhotoGrid items={photoGridItems} />
          ) : (
            <EmptyState
              icon={<ImgIcon className="w-6 h-6" />}
              title={viewMode === 'matches' ? 'No matched photos for you yet' : 'No photos in this event yet'}
              description={viewMode === 'matches' ? 'Switch to All Media to view every uploaded photo in this event.' : 'No photos uploaded yet.'}
              action={viewMode === 'matches' && photos.length > 0 ? (
                <Button variant="secondary" size="sm" onClick={() => setViewMode('all')}>Browse All Photos ({photos.length})</Button>
              ) : undefined}
            />
          )}
        </section>
      </main>
    </div>
  );
}
