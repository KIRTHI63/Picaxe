'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, CardSkeleton } from '@/components/ui/Loading';
import { Camera, FileText, Calendar, ChevronRight, Download, ScanFace, AlertCircle, LogIn } from 'lucide-react';
import {
  api,
  getToken,
  getStoredUser,
  StudentProfileData,
  StudentMatchedPhoto,
  StudentMatchedCertificate,
} from '@/lib/api';

export default function StudentDashboard() {
  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [photos, setPhotos] = useState<StudentMatchedPhoto[]>([]);
  const [certificates, setCertificates] = useState<StudentMatchedCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const token = getToken();
    const user = getStoredUser();
    if (!token || !user) {
      setAuthError('Sign in with your Student account to load your real profile and AI-matched photos.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setAuthError(null);
    try {
      const [p, ph, certs] = await Promise.all([
        api.students.getMyProfile(),
        api.students.getMyPhotos(),
        api.students.getMyCertificates(),
      ]);
      setProfile(p);
      setPhotos(ph);
      setCertificates(certs);
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to load student profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col bg-basalt">
        <Navbar context="student" />
        <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </main>
      </div>
    );
  }

  if (authError || !profile) {
    return (
      <div className="min-h-dvh flex flex-col bg-basalt">
        <Navbar context="student" />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="card p-8 max-w-md w-full text-center flex flex-col items-center gap-4">
            <AlertCircle className="w-8 h-8 text-seam-gold" />
            <h1 className="font-sans font-semibold text-xl text-bone">Student Sign In Required</h1>
            <p className="font-sans text-sm text-ash">{authError}</p>
            <Link href="/auth?role=STUDENT&next=/student">
              <Button variant="primary" size="md" icon={<LogIn className="w-4 h-4" />}>
                Sign In / Create Student Account
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Group real matches by event
  const eventMap = new Map<string, { id: string; title: string; date: string; photos: number; certs: number }>();
  for (const item of photos) {
    const ev = item.photo.event;
    const cur = eventMap.get(ev.id) || { id: ev.id, title: ev.title, date: ev.startDate, photos: 0, certs: 0 };
    cur.photos += 1;
    eventMap.set(ev.id, cur);
  }
  for (const item of certificates) {
    const ev = item.certificate.event;
    const cur = eventMap.get(ev.id) || { id: ev.id, title: ev.title, date: ev.startDate, photos: 0, certs: 0 };
    cur.certs += 1;
    eventMap.set(ev.id, cur);
  }
  const matchedEvents = Array.from(eventMap.values());

  const stats = [
    { label: 'Matched Photos', value: String(photos.length), icon: <Camera className="w-4 h-4" /> },
    { label: 'Certificates', value: String(certificates.length), icon: <FileText className="w-4 h-4" /> },
    { label: 'Matched Events', value: String(matchedEvents.length), icon: <Calendar className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-dvh flex flex-col bg-basalt">
      <Navbar context="student" />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-8 py-10 md:py-16 flex flex-col gap-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="font-sans font-semibold text-3xl md:text-4xl text-bone mb-1.5">
                Welcome back, {profile.fullName}
              </h1>
              <p className="font-sans text-ash text-sm">
                {profile.email || 'Student Account'}{profile.institution ? ` · ${profile.institution}` : ''}
              </p>
            </div>
            <Link href="/student/register">
              <Button variant={profile.registrationStatus === 'VERIFIED' ? 'secondary' : 'primary'} size="sm" icon={<ScanFace className="w-4 h-4" />}>
                {profile.registrationStatus === 'VERIFIED' ? 'Update Face Biometrics' : 'Register Your Face'}
              </Button>
            </Link>
          </div>
        </motion.div>

        {profile.registrationStatus === 'VERIFIED' ? (
          <div className="card p-4 flex items-center justify-between gap-4 border-verdigris/25 bg-verdigris-muted/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-verdigris/20 flex items-center justify-center text-verdigris font-semibold text-xs overflow-hidden">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.fullName} className="w-full h-full object-cover" />
                ) : (
                  '✓'
                )}
              </div>
              <div>
                <p className="font-sans font-medium text-bone text-sm">Biometric Profile Verified</p>
                <p className="font-mono text-[10px] text-ash">
                  {profile.faceEmbedding?.dimensions || 512}-D {profile.faceEmbedding?.modelVersion || 'ArcFace'} · Qdrant ID {profile.faceEmbedding?.qdrantPointId?.slice(0, 8)}...
                </p>
              </div>
            </div>
            <Badge variant="success" dot>Verified</Badge>
          </div>
        ) : (
          <div className="card p-4 flex items-center justify-between gap-4 border-seam-gold/25 bg-seam-gold/5">
            <div className="flex items-center gap-3">
              <ScanFace className="w-6 h-6 text-seam-gold shrink-0" />
              <div>
                <p className="font-sans font-medium text-bone text-sm">
                  Face Status: {profile.registrationStatus}
                </p>
                <p className="font-mono text-[10px] text-ash">
                  Upload a clear portrait photo so Qdrant & ArcFace can match you in event photos.
                </p>
              </div>
            </div>
            <Link href="/student/register">
              <Button variant="secondary" size="sm">Register Now</Button>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="card p-4 md:p-5 flex flex-col gap-3">
              <div className="w-8 h-8 rounded-md bg-basalt border border-surface-border flex items-center justify-center text-ash">{s.icon}</div>
              <div>
                <p className="font-sans font-semibold text-2xl text-bone">{s.value}</p>
                <p className="font-mono text-[10px] text-ash uppercase tracking-wide mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div>
          <h2 className="font-sans font-semibold text-lg text-bone mb-4">Your Matched Events</h2>
          <div className="flex flex-col gap-3">
            {matchedEvents.length > 0 ? (
              matchedEvents.map(ev => (
                <Link key={ev.id} href={`/student/events/${ev.id}`}>
                  <div className="card p-5 flex items-center justify-between gap-4 hover:border-seam-gold/30 transition-colors cursor-pointer group">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <h3 className="font-sans font-medium text-bone group-hover:text-seam-gold transition-colors">{ev.title}</h3>
                        <Badge variant="success" dot>{ev.photos} Photos</Badge>
                      </div>
                      <p className="font-mono text-[10px] text-ash">
                        {new Date(ev.date).toLocaleDateString()} · {ev.photos} photos · {ev.certs} cert{ev.certs !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-ash group-hover:text-bone transition-colors shrink-0" />
                  </div>
                </Link>
              ))
            ) : (
              <EmptyState
                icon={<Calendar className="w-6 h-6 text-ash" />}
                title="No matched events yet"
                description="Once an organization uploads event photos where your registered face is detected, they will appear here."
              />
            )}
          </div>
        </div>

        <div>
          <h2 className="font-sans font-semibold text-lg text-bone mb-4">Your Matched Photos ({photos.length})</h2>
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {photos.map(item => (
                <a key={item.tagId} href={item.photo.publicUrl} target="_blank" rel="noopener noreferrer" className="card overflow-hidden group aspect-[4/3] relative block">
                  <img src={item.photo.publicUrl} alt={item.photo.originalFilename} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-basalt/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                    <p className="font-sans text-xs text-bone font-medium truncate">{item.photo.originalFilename}</p>
                    <p className="font-mono text-[9px] text-verdigris">
                      {Math.round(item.confidenceScore * 100)}% similarity · {item.status}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Camera className="w-6 h-6 text-ash" />}
              title="No photos matched yet"
              description="Register your face first; any real photos matching your ArcFace embedding will appear here."
            />
          )}
        </div>

        <div>
          <h2 className="font-sans font-semibold text-lg text-bone mb-4">Certificates ({certificates.length})</h2>
          <div className="flex flex-col gap-3">
            {certificates.length > 0 ? (
              certificates.map(cert => (
                <div key={cert.tagId} className="card p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-12 bg-basalt border border-surface-border rounded-md flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-ash/40" />
                    </div>
                    <div>
                      <p className="font-sans font-medium text-bone text-sm">{cert.certificate.originalFilename}</p>
                      <p className="font-mono text-[10px] text-verdigris mt-1">
                        OCR Matched: &ldquo;{cert.extractedName}&rdquo; ({Math.round(cert.confidenceScore * 100)}%) · {cert.certificate.event.title}
                      </p>
                    </div>
                  </div>
                  <a href={cert.certificate.publicUrl} download={cert.certificate.originalFilename} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" icon={<Download className="w-4 h-4" />}>
                      Download
                    </Button>
                  </a>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<FileText className="w-6 h-6 text-ash" />}
                title="No certificates matched yet"
                description="Uploaded certificates containing your name in OCR text will appear here."
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
