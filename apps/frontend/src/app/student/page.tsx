'use client';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/Loading';
import { Camera, FileText, Calendar, ChevronRight, ArrowRight, Bell, Image as ImgIcon } from 'lucide-react';

const RECENT_EVENTS = [
  { id: 'tech-fest-2026', title: 'Annual Tech Fest — 2026', date: 'Mar 14, 2026', newMatches: 12, photos: 142, certs: 1, status: 'new' },
  { id: 'hackathon-alpha', title: 'Hackathon Alpha', date: 'Jan 22, 2026', newMatches: 0, photos: 8, certs: 2, status: 'viewed' },
];

const STATS = [
  { label: 'Matched Photos', value: '20', icon: <Camera className="w-4 h-4" /> },
  { label: 'Certificates', value: '3', icon: <FileText className="w-4 h-4" /> },
  { label: 'Events', value: '2', icon: <Calendar className="w-4 h-4" /> },
];

export default function StudentDashboard() {
  const newMatchEvent = RECENT_EVENTS.find(e => e.newMatches > 0);

  return (
    <div className="min-h-dvh flex flex-col bg-basalt">
      <Navbar context="student" />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-8 py-10 md:py-16 flex flex-col gap-10">

        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="font-sans font-semibold text-3xl md:text-4xl text-bone mb-1.5">Welcome back, Kirthivasan</h1>
          <p className="font-sans text-ash">Your personalized event photo dashboard.</p>
        </motion.div>

        {/* New match callout */}
        {newMatchEvent && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Link href={`/student/events/${newMatchEvent.id}`}>
              <div className="card p-5 flex items-center justify-between gap-4 border-verdigris/25 hover:border-verdigris/50 transition-colors group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-verdigris-muted border border-verdigris/25 flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5 text-verdigris" />
                  </div>
                  <div>
                    <p className="font-sans font-medium text-bone">
                      You have <span className="text-verdigris">{newMatchEvent.newMatches} new photos</span> from {newMatchEvent.title}
                    </p>
                    <p className="font-mono text-[10px] text-ash mt-0.5">AI matched · {newMatchEvent.date}</p>
                  </div>
                </div>
                <Button variant="primary" size="sm" className="shrink-0 gap-1.5">
                  View Photos <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Link>
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {STATS.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }}
              className="card p-4 md:p-5 flex flex-col gap-3">
              <div className="w-8 h-8 rounded-md bg-basalt border border-surface-border flex items-center justify-center text-ash">{s.icon}</div>
              <div>
                <p className="font-sans font-semibold text-2xl text-bone">{s.value}</p>
                <p className="font-mono text-[10px] text-ash uppercase tracking-wide mt-0.5">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Recent Events */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans font-semibold text-lg text-bone">Recent Events</h2>
            <Button variant="ghost" size="sm" className="font-mono text-xs text-ash">View all</Button>
          </div>
          <div className="flex flex-col gap-3">
            {RECENT_EVENTS.length > 0 ? RECENT_EVENTS.map(ev => (
              <Link key={ev.id} href={`/student/events/${ev.id}`}>
                <div className="card p-5 flex items-center justify-between gap-4 hover:border-ash/25 transition-colors cursor-pointer group">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-sans font-medium text-bone group-hover:text-seam-gold transition-colors">{ev.title}</h3>
                      {ev.newMatches > 0 && <Badge variant="success" dot pulse>{ev.newMatches} New</Badge>}
                    </div>
                    <p className="font-mono text-[10px] text-ash">{ev.date} · {ev.photos} photos · {ev.certs} cert{ev.certs !== 1 ? 's' : ''}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ash group-hover:text-bone transition-colors shrink-0" />
                </div>
              </Link>
            )) : (
              <EmptyState
                icon={<Calendar className="w-6 h-6" />}
                title="No events yet"
                description="Once your organization uploads event media, your matches will appear here."
              />
            )}
          </div>
        </div>

        {/* Certificates */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans font-semibold text-lg text-bone">Certificates</h2>
          </div>
          <div className="flex flex-col gap-3">
            <div className="card p-5 flex items-center gap-4">
              <div className="w-10 h-12 bg-basalt border border-surface-border rounded-md flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-ash/40" />
              </div>
              <div className="flex-1">
                <p className="font-sans font-medium text-bone text-sm">TechFest_Participation_cert-1.pdf</p>
                <p className="font-mono text-[10px] text-verdigris mt-1">AI Match · Annual Tech Fest 2026</p>
              </div>
              <Button variant="ghost" size="sm" icon={<ImgIcon className="w-4 h-4" />} aria-label="Download certificate">
                <span className="hidden sm:inline">Download</span>
              </Button>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
