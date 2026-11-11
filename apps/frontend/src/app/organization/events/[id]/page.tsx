'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PhotoGrid, MediaItem } from '@/components/PhotoGrid';
import { UploadZone } from '@/components/UploadZone';
import { EmptyState, CardSkeleton } from '@/components/ui/Loading';
import { useToast } from '@/components/ui/Toast';
import {
  ChevronLeft, UploadCloud, CheckCircle2, Users,
  Image as ImgIcon, Check, X, AlertCircle, FileText
} from 'lucide-react';
import { api, EventRecord, MediaAssetRecord } from '@/lib/api';

export default function OrgEventView() {
  const routeParams = useParams();
  const rawId = routeParams?.id;
  const eventId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';
  const { toast } = useToast();

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [mediaAssets, setMediaAssets] = useState<MediaAssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'media' | 'students' | 'upload' | 'review'>('media');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'matches'>('all');

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [ev, media] = await Promise.all([
        api.events.getById(eventId),
        api.media.getEventMedia(eventId),
      ]);
      setEvent(ev);
      setMediaAssets(media);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReview = async (tagType: 'PHOTO' | 'CERTIFICATE', tagId: string, decision: 'CONFIRMED' | 'REJECTED') => {
    try {
      if (tagType === 'PHOTO') await api.media.reviewPhotoTag(tagId, decision);
      else await api.media.reviewCertTag(tagId, decision);
      toast({
        type: decision === 'CONFIRMED' ? 'success' : 'info',
        title: decision === 'CONFIRMED' ? 'Match verified' : 'Match removed',
      });
      loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Review failed', description: err?.message });
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col bg-basalt">
        <Navbar context="organization" />
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </main>
      </div>
    );
  }

  if (errorMsg || !event) {
    return (
      <div className="min-h-dvh flex flex-col bg-basalt">
        <Navbar context="organization" />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="card p-8 max-w-md text-center flex flex-col items-center gap-4">
            <AlertCircle className="w-8 h-8 text-danger" />
            <h1 className="font-sans font-semibold text-xl text-bone">Could Not Load Event</h1>
            <p className="font-sans text-sm text-ash">{errorMsg || 'Event not found'}</p>
            <Link href="/organization">
              <Button variant="secondary" size="sm">Back to Dashboard</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const photos = mediaAssets.filter(m => m.type === 'PHOTO');
  const certs = mediaAssets.filter(m => m.type === 'CERTIFICATE');
  const matchedAssets = mediaAssets.filter(m =>
    (m.photoTags?.some(t => t.status !== 'REJECTED')) ||
    (m.certificateTags?.some(t => t.status !== 'REJECTED')),
  );

  // Build real pending review tags across photos & certificates
  const pendingTags = mediaAssets.flatMap(asset => [
    ...(asset.photoTags || [])
      .filter(t => t.status === 'PENDING')
      .map(t => ({ asset, tag: t, tagType: 'PHOTO' as const })),
    ...(asset.certificateTags || [])
      .filter(t => t.status === 'PENDING')
      .map(t => ({ asset, tag: t, tagType: 'CERTIFICATE' as const })),
  ]);

  // Aggregate real matched students from PostgreSQL tags
  const studentMap = new Map<string, {
    id: string;
    fullName: string;
    institution?: string | null;
    avatarUrl?: string | null;
    photos: number;
    certs: number;
    maxConfidence: number;
  }>();

  for (const asset of mediaAssets) {
    for (const tag of asset.photoTags || []) {
      if (tag.status === 'REJECTED' || !tag.studentProfile) continue;
      const cur = studentMap.get(tag.studentProfile.id) || {
        id: tag.studentProfile.id,
        fullName: tag.studentProfile.fullName,
        institution: tag.studentProfile.institution,
        avatarUrl: tag.studentProfile.avatarUrl,
        photos: 0,
        certs: 0,
        maxConfidence: 0,
      };
      cur.photos += 1;
      cur.maxConfidence = Math.max(cur.maxConfidence, tag.confidenceScore);
      studentMap.set(tag.studentProfile.id, cur);
    }
    for (const tag of asset.certificateTags || []) {
      if (tag.status === 'REJECTED' || !tag.studentProfile) continue;
      const cur = studentMap.get(tag.studentProfile.id) || {
        id: tag.studentProfile.id,
        fullName: tag.studentProfile.fullName,
        institution: tag.studentProfile.institution,
        avatarUrl: tag.studentProfile.avatarUrl,
        photos: 0,
        certs: 0,
        maxConfidence: 0,
      };
      cur.certs += 1;
      cur.maxConfidence = Math.max(cur.maxConfidence, tag.confidenceScore);
      studentMap.set(tag.studentProfile.id, cur);
    }
  }
  const matchedStudents = Array.from(studentMap.values());

  const photoGridItems: MediaItem[] = (mediaFilter === 'matches'
    ? photos.filter(p => p.photoTags?.some(t => t.status !== 'REJECTED'))
    : photos
  ).map(p => ({
    id: p.id,
    url: p.publicUrl,
    isMatch: Boolean(p.photoTags?.some(t => t.status !== 'REJECTED')),
    type: 'photo',
  }));

  return (
    <div className="min-h-dvh flex flex-col bg-basalt">
      <Navbar context="organization" />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="flex items-center justify-between mb-8 gap-4">
          <Link href="/organization" className="flex items-center gap-1.5 text-ash hover:text-bone transition-colors font-sans text-sm">
            <ChevronLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            {pendingTags.length > 0 ? (
              <Badge variant="warning" dot pulse>{pendingTags.length} Reviews Needed</Badge>
            ) : (
              <Badge variant="success" dot>{event.status}</Badge>
            )}
          </div>
        </div>

        <div className="mb-10 pb-8 border-b border-surface-border">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-sans font-semibold text-3xl md:text-4xl text-bone tracking-tight mb-2">
                {event.title}
              </h1>
              <p className="font-sans text-sm text-ash max-w-2xl mb-4">
                {event.description || 'Event media repository powered by InsightFace & OCR/NER.'}
              </p>
              <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-ash">
                <span>{new Date(event.startDate).toLocaleDateString()}</span>
                {event.location && <><span>·</span><span>{event.location}</span></>}
                <span>·</span>
                <span>{mediaAssets.length} uploaded file(s)</span>
                <span>·</span>
                <span>{matchedAssets.length} matched file(s)</span>
              </div>
            </div>

            <Button variant="primary" size="sm" icon={<UploadCloud className="w-4 h-4" />} onClick={() => setActiveTab('upload')}>
              Upload Media
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card p-5">
            <p className="font-sans font-semibold text-2xl text-bone mb-1">{mediaAssets.length}</p>
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide">Real Uploaded Files</p>
          </div>
          <div className="card p-5">
            <p className="font-sans font-semibold text-2xl text-bone mb-1">{matchedStudents.length}</p>
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide">Matched Students</p>
          </div>
          <div className="card p-5">
            <p className="font-sans font-semibold text-2xl text-bone mb-1">{pendingTags.length}</p>
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide">Pending Reviews</p>
          </div>
          <div className="card p-5">
            <p className="font-sans font-semibold text-2xl text-bone mb-1">
              {mediaAssets.length > 0 ? `${Math.round((matchedAssets.length / mediaAssets.length) * 100)}%` : '0%'}
            </p>
            <p className="font-mono text-[10px] text-ash uppercase tracking-wide">Match Rate</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-surface border border-surface-border p-1 rounded-md mb-8 w-fit">
          <button
            onClick={() => setActiveTab('media')}
            className={`px-4 py-1.5 text-xs font-sans rounded-sm transition-all ${
              activeTab === 'media' ? 'bg-basalt text-bone border border-surface-border font-medium' : 'text-ash hover:text-bone'
            }`}
          >
            Media Gallery ({mediaAssets.length})
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-1.5 text-xs font-sans rounded-sm transition-all ${
              activeTab === 'students' ? 'bg-basalt text-bone border border-surface-border font-medium' : 'text-ash hover:text-bone'
            }`}
          >
            Matched Students ({matchedStudents.length})
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-1.5 text-xs font-sans rounded-sm transition-all ${
              activeTab === 'upload' ? 'bg-basalt text-bone border border-surface-border font-medium' : 'text-ash hover:text-bone'
            }`}
          >
            Upload Media
          </button>
          {pendingTags.length > 0 && (
            <button
              onClick={() => setActiveTab('review')}
              className={`px-4 py-1.5 text-xs font-sans rounded-sm transition-all flex items-center gap-1.5 ${
                activeTab === 'review' ? 'bg-basalt text-bone border border-surface-border font-medium' : 'text-ash hover:text-bone'
              }`}
            >
              <span>Review Queue</span>
              <span className="font-mono text-[9px] bg-seam-gold/20 text-seam-gold px-1.5 py-0.2 rounded-full border border-seam-gold/30">
                {pendingTags.length}
              </span>
            </button>
          )}
        </div>

        {activeTab === 'media' && (
          <div className="flex flex-col gap-8">
            {mediaAssets.length > 0 ? (
              <>
                {photos.length > 0 && (
                  <section className="flex flex-col gap-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setMediaFilter('all')}
                          className={`px-3 py-1 text-xs rounded border ${mediaFilter === 'all' ? 'bg-surface-50 text-bone border-seam-gold/50' : 'text-ash border-surface-border'}`}
                        >
                          All Photos ({photos.length})
                        </button>
                        <button
                          onClick={() => setMediaFilter('matches')}
                          className={`px-3 py-1 text-xs rounded border ${mediaFilter === 'matches' ? 'bg-surface-50 text-bone border-seam-gold/50' : 'text-ash border-surface-border'}`}
                        >
                          Matched ({photos.filter(p => p.photoTags?.some(t => t.status !== 'REJECTED')).length})
                        </button>
                      </div>
                    </div>
                    <PhotoGrid items={photoGridItems} />
                  </section>
                )}

                {certs.length > 0 && (
                  <section className="flex flex-col gap-3">
                    <h2 className="font-sans font-semibold text-lg text-bone">Certificates ({certs.length})</h2>
                    {certs.map(cert => {
                      const tag = cert.certificateTags?.find(t => t.status !== 'REJECTED');
                      return (
                        <div key={cert.id} className="card p-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-ash shrink-0" />
                            <div>
                              <p className="font-sans text-sm font-medium text-bone">{cert.originalFilename}</p>
                              <p className="font-mono text-[10px] text-ash mt-0.5">
                                {cert.processingStatus === 'FAILED'
                                  ? `AI Error: ${cert.processingError}`
                                  : tag
                                  ? `Matched: ${tag.studentProfile?.fullName} (Extracted: "${tag.extractedName}", ${Math.round(tag.confidenceScore * 100)}%)`
                                  : 'No matching registered student found in certificate text'}
                              </p>
                            </div>
                          </div>
                          <a href={cert.publicUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-seam-gold hover:underline">
                            Open File
                          </a>
                        </div>
                      );
                    })}
                  </section>
                )}
              </>
            ) : (
              <EmptyState
                icon={<ImgIcon className="w-8 h-8 text-ash" />}
                title="No media uploaded yet"
                description="Upload real event photos or certificates to run InsightFace / OCR and populate this gallery."
                action={
                  <Button variant="primary" size="sm" icon={<UploadCloud className="w-4 h-4" />} onClick={() => setActiveTab('upload')}>
                    Upload Media Now
                  </Button>
                }
              />
            )}
          </div>
        )}

        {activeTab === 'students' && (
          <div className="flex flex-col gap-6">
            {matchedStudents.length > 0 ? (
              <div className="card divide-y divide-surface-border overflow-hidden">
                {matchedStudents.map(s => (
                  <div key={s.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-seam-gold/20 border border-seam-gold/30 flex items-center justify-center font-mono text-xs font-semibold text-seam-gold overflow-hidden">
                        {s.avatarUrl ? <img src={s.avatarUrl} alt={s.fullName} className="w-full h-full object-cover" /> : s.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-sans font-medium text-bone text-sm">{s.fullName}</p>
                        <p className="font-mono text-[10px] text-ash">{s.institution || 'Registered Student'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-sans font-medium text-bone text-sm">{s.photos} photo(s) · {s.certs} cert(s)</p>
                        <p className="font-mono text-[10px] text-seam-gold">Peak match: {Math.round(s.maxConfidence * 100)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Users className="w-8 h-8 text-ash" />}
                title="No matched students yet"
                description="Upload photos with registered students' faces or certificates to see real AI matches here."
              />
            )}
          </div>
        )}

        {activeTab === 'upload' && (
          <UploadZone
            eventId={event.id}
            onComplete={assets => {
              const tags = assets.reduce((s, a) => s + (a.photoTags?.length ?? 0) + (a.certificateTags?.length ?? 0), 0);
              toast({
                type: 'success',
                title: 'Upload complete',
                description: `Stored ${assets.length} file(s); ${tags} real match(es) identified.`,
              });
              loadData();
              setActiveTab('media');
            }}
            onError={msg => toast({ type: 'error', title: 'Upload failed', description: msg })}
          />
        )}

        {activeTab === 'review' && (
          <div className="flex flex-col gap-4">
            {pendingTags.length > 0 ? (
              pendingTags.map(({ asset, tag, tagType }) => (
                <div key={tag.id} className="card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-basalt border border-surface-border rounded-lg overflow-hidden shrink-0">
                      <img src={asset.publicUrl} alt={asset.originalFilename} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="font-sans font-medium text-bone text-sm">{tag.studentProfile?.fullName || 'Student'}</p>
                      <p className="font-mono text-[10px] text-ash">{asset.originalFilename} · {Math.round(tag.confidenceScore * 100)}% confidence</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="secondary" size="sm" icon={<Check className="w-4 h-4 text-verdigris" />} onClick={() => handleReview(tagType, tag.id, 'CONFIRMED')}>
                      Approve
                    </Button>
                    <Button variant="ghost" size="sm" icon={<X className="w-4 h-4 text-danger" />} onClick={() => handleReview(tagType, tag.id, 'REJECTED')}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon={<CheckCircle2 className="w-8 h-8 text-verdigris" />} title="Review Queue Cleared" description="No uncertain matches pending." />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
