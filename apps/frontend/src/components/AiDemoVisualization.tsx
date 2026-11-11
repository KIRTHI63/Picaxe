'use client';
import React from 'react';
import { ScanFace, FileText, Database, ShieldCheck, ArrowRight } from 'lucide-react';

const STAGES = [
  {
    step: '01',
    icon: <ScanFace className="w-5 h-5 text-seam-gold" />,
    title: 'Face Detection & Quality Gate',
    detail: 'InsightFace SCRFD locates faces and enforces blur, brightness, and bounding-box fraction checks before generating 512-D ArcFace embeddings.',
  },
  {
    step: '02',
    icon: <Database className="w-5 h-5 text-seam-gold" />,
    title: 'Qdrant Cosine Similarity Search',
    detail: 'Detected embeddings query the Qdrant vector collection using unit L2 cosine similarity against verified student biometric vectors.',
  },
  {
    step: '03',
    icon: <FileText className="w-5 h-5 text-verdigris" />,
    title: 'Certificate OCR & NER Matching',
    detail: 'PaddleOCR / RapidOCR extracts certificate text, then recipient anchors, spaCy NER, and RapidFuzz match verified student names.',
  },
  {
    step: '04',
    icon: <ShieldCheck className="w-5 h-5 text-verdigris" />,
    title: 'Confidence Tiers & Human Review',
    detail: 'High-confidence matches confirm automatically; uncertain matches route to the Organization Review Queue with full audit logs.',
  },
];

export function AiDemoVisualization() {
  return (
    <div className="w-full bg-surface border border-surface-border rounded-xl overflow-hidden shadow-overlay">
      <div className="flex items-center justify-between px-4 py-3 bg-basalt-50 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-danger/50" />
          <div className="w-3 h-3 rounded-full bg-seam-gold/50" />
          <div className="w-3 h-3 rounded-full bg-verdigris/50" />
          <span className="ml-3 font-mono text-xs text-ash">picaxe — production AI architecture</span>
        </div>
        <span className="font-mono text-[10px] text-ash uppercase tracking-widest">
          InsightFace + Qdrant + OCR/NER
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-surface-border">
        <div className="p-6 grid grid-cols-1 gap-4">
          {STAGES.slice(0, 2).map((s) => (
            <div key={s.step} className="p-4 rounded-lg bg-basalt border border-surface-border flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-surface border border-surface-border flex items-center justify-center shrink-0">
                {s.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] text-seam-gold">{s.step}</span>
                  <h3 className="font-sans font-medium text-sm text-bone">{s.title}</h3>
                </div>
                <p className="font-sans text-xs text-ash leading-relaxed">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 grid grid-cols-1 gap-4">
          {STAGES.slice(2).map((s) => (
            <div key={s.step} className="p-4 rounded-lg bg-basalt border border-surface-border flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-surface border border-surface-border flex items-center justify-center shrink-0">
                {s.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] text-verdigris">{s.step}</span>
                  <h3 className="font-sans font-medium text-sm text-bone">{s.title}</h3>
                </div>
                <p className="font-sans text-xs text-ash leading-relaxed">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 py-3 bg-basalt-50 border-t border-surface-border flex items-center justify-between text-xs font-mono text-ash">
        <span>Sign in as a Student or Organization to run real inference</span>
        <span className="flex items-center gap-1 text-seam-gold">No simulated results <ArrowRight className="w-3 h-3" /></span>
      </div>
    </div>
  );
}
