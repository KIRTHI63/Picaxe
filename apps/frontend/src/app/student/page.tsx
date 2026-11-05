'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/Loading';
import { Camera, FileText, Calendar, ChevronRight, ArrowRight, Bell, Download, ScanFace } from 'lucide-react';
import {
  getRealStudentProfile,
  getStudentMatchedMedia,
  getRealEvents,
  RealStudentProfile,
  RealMediaItem,
  RealEvent,
} from '@/lib/picaxe-store';

export default function StudentDashboard() {
  const [student, setStudent] = useState<RealStudentProfile | null>(null);
  const [matchedPhotos, setMatchedPhotos] = useState<RealMediaItem[]>([]);
  const [matchedCerts, setMatchedCerts] = useState<RealMediaItem[]>([]);
  const [events, setEvents] = useState<RealEvent[]>([]);

  const loadData = () => {
    setStudent(getRealStudentProfile());
    const { photos, certificates } = getStudentMatchedMedia();
    setMatchedPhotos(photos);
    setMatchedCerts(certificates);
    setEvents(getRealEvents());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('picaxe_store_updated', loadData);
    return () => window.removeEventListener('picaxe_store_updated', loadData);
  }, []);

  if (!student) return null;

  // Filter events where student has real matches
  const studentEvents = events.filter(e =>
    matchedPhotos.some(p => p.eventId === e.id) || matchedCerts.some(c => c.eventId === e.id)
  );

  const stats = [
    { label: 'Matched Photos', value: String(matchedPhotos.length), icon: <Camera className="w-4 h-4" /> },
    { label: 'Certificates', value: String(matchedCerts.length), icon: <FileText className="w-4 h-4" /> },
    { label: 'Active Events', value: String(studentEvents.length), icon: <Calendar className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-dvh flex flex-col bg-basalt">
      <Navbar context="student" />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-8 py-10 md:py-16 flex flex-col gap-10">
        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="font-sans font-semibold text-3xl md:text-4xl text-bone mb-1.5">
                Welcome back, {student.name}
              </h1>
              <p className="font-sans text-ash text-sm">
                {student.email} · {student.rollNumber} · {student.department}
              </p>
            </div>
            {!student.isFaceRegistered && (
              <Link href="/student/register">
                <Button variant="primary" size="sm" icon={<ScanFace className="w-4 h-4" />}>
                  Register Your Face
                </Button>
              </Link>
            )}
          </div>
        </motion.div>

        {/* Biometric Status Notification */}
        {student.isFaceRegistered ? (
          <div className="card p-4 flex items-center justify-between gap-4 border-verdigris/25 bg-verdigris-muted/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-verdigris/20 flex items-center justify-center text-verdigris font-semibold text-xs overflow-hidden">
                {student.registeredFaceUrl ? (
                  <img src={student.registeredFaceUrl} alt={student.name} className="w-full h-full object-cover" />
                ) : (
                  '✓'
                )}
              </div>
              <div>
                <p className="font-sans font-medium text-bone text-sm">Biometrics Active & Enrolled</p>
                <p className="font-mono text-[10px] text-ash">512D ArcFace facial signature generated · Registered {student.registeredAt}</p>
              </div>
            </div>
            <Badge variant="success" dot>Enrolled</Badge>
          </div>
        ) : (
          <div className="card p-4 flex items-center justify-between gap-4 border-seam-gold/25 bg-seam-gold/5">
            <div className="flex items-center gap-3">
              <ScanFace className="w-6 h-6 text-seam-gold shrink-0" />
              <div>
                <p className="font-sans font-medium text-bone text-sm">Face Not Registered</p>
                <p className="font-mono text-[10px] text-ash">Upload a portrait to enable automated AI photo tagging.</p>
              </div>
            </div>
            <Link href="/student/register">
              <Button variant="secondary" size="sm">Register Now</Button>
            </Link>
          </div>
        )}

        {/* Real Stats */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.06 }}
              className="card p-4 md:p-5 flex flex-col gap-3"
            >
              <div className="w-8 h-8 rounded-md bg-basalt border border-surface-border flex items-center justify-center text-ash">{s.icon}</div>
              <div>
                <p className="font-sans font-semibold text-2xl text-bone">{s.value}</p>
                <p className="font-mono text-[10px] text-ash uppercase tracking-wide mt-0.5">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Events where student has real matches */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans font-semibold text-lg text-bone">Your Matched Events</h2>
          </div>
          <div className="flex flex-col gap-3">
            {studentEvents.length > 0 ? (
              studentEvents.map(ev => {
                const evPhotos = matchedPhotos.filter(p => p.eventId === ev.id).length;
                const evCerts = matchedCerts.filter(c => c.eventId === ev.id).length;
                return (
                  <Link key={ev.id} href={`/organization/events/${ev.id}`}>
                    <div className="card p-5 flex items-center justify-between gap-4 hover:border-seam-gold/30 transition-colors cursor-pointer group">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <h3 className="font-sans font-medium text-bone group-hover:text-seam-gold transition-colors">{ev.title}</h3>
                          <Badge variant="success" dot>{evPhotos} Matched Photos</Badge>
                        </div>
                        <p className="font-mono text-[10px] text-ash">{ev.date} · {evPhotos} photos · {evCerts} certificate{evCerts !== 1 ? 's' : ''}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-ash group-hover:text-bone transition-colors shrink-0" />
                    </div>
                  </Link>
                );
              })
            ) : (
              <EmptyState
                icon={<Calendar className="w-6 h-6 text-ash" />}
                title="No matched events yet"
                description="Once event media is uploaded containing your face, your matched photos will appear here automatically."
              />
            )}
          </div>
        </div>

        {/* Real Matched Photos Gallery */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans font-semibold text-lg text-bone">Your Matched Photos ({matchedPhotos.length})</h2>
          </div>
          {matchedPhotos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {matchedPhotos.map(p => (
                <div key={p.id} className="card overflow-hidden group aspect-[4/3] relative">
                  <img src={p.url} alt={p.filename} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-basalt/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                    <p className="font-sans text-xs text-bone font-medium truncate">{p.filename}</p>
                    <p className="font-mono text-[9px] text-verdigris">{p.confidenceScore}% confidence</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Camera className="w-6 h-6 text-ash" />}
              title="No photos matched yet"
              description="Upload your face biometrics and wait for your organization to upload event photos."
            />
          )}
        </div>

        {/* Real Certificates */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans font-semibold text-lg text-bone">Certificates ({matchedCerts.length})</h2>
          </div>
          <div className="flex flex-col gap-3">
            {matchedCerts.length > 0 ? (
              matchedCerts.map(cert => (
                <div key={cert.id} className="card p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-12 bg-basalt border border-surface-border rounded-md flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-ash/40" />
                    </div>
                    <div>
                      <p className="font-sans font-medium text-bone text-sm">{cert.filename}</p>
                      <p className="font-mono text-[10px] text-verdigris mt-1">Verified OCR Match · {cert.eventName}</p>
                    </div>
                  </div>
                  <a href={cert.url} download={cert.filename} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" icon={<Download className="w-4 h-4" />}>
                      Download
                    </Button>
                  </a>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<FileText className="w-6 h-6 text-ash" />}
                title="No certificates yet"
                description="Certificates with your name extracted via OCR will appear here."
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
