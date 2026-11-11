'use client';
import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, Check, Sparkles, X, AlertCircle, Camera, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, MediaAssetRecord } from '@/lib/api';

interface UploadZoneProps {
  className?: string;
  eventId?: string;
  onComplete?: (uploadedAssets: MediaAssetRecord[]) => void;
  onError?: (message: string) => void;
}

export function UploadZone({ className, eventId, onComplete, onError }: UploadZoneProps) {
  const [mediaType, setMediaType] = useState<'PHOTO' | 'CERTIFICATE'>('PHOTO');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [progressText, setProgressText] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [results, setResults] = useState<MediaAssetRecord[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (filesList: FileList | File[]) => {
    const files = Array.from(filesList);
    if (!files.length) return;

    if (!eventId) {
      const msg = 'Select or create an event first before uploading media.';
      setErrorMsg(msg);
      setStatus('error');
      onError?.(msg);
      return;
    }

    setStatus('uploading');
    setErrorMsg(null);
    setResults([]);
    setProgressPct(0);

    const uploadedAssets: MediaAssetRecord[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgressText(`Uploading & running AI on "${file.name}" (${i + 1} of ${files.length})...`);
        const asset = await api.media.upload(eventId, file, mediaType);
        uploadedAssets.push(asset);
        setProgressPct(Math.round(((i + 1) / files.length) * 100));
      }

      setResults(uploadedAssets);
      setStatus('done');
      onComplete?.(uploadedAssets);
    } catch (err: any) {
      const msg = err?.message || 'Upload or AI processing failed';
      setErrorMsg(msg);
      setStatus('error');
      onError?.(msg);
    }
  };

  const reset = () => {
    setStatus('idle');
    setProgressPct(0);
    setProgressText('');
    setResults([]);
    setErrorMsg(null);
  };

  const totalTagsCreated = results.reduce(
    (sum, r) => sum + (r.photoTags?.length ?? 0) + (r.certificateTags?.length ?? 0),
    0,
  );
  const failedAssets = results.filter(r => r.processingStatus === 'FAILED');

  return (
    <div className={cn('w-full flex flex-col gap-3', className)}>
      {/* Media Type Selector */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-ash uppercase tracking-widest">Pipeline:</span>
        <div className="flex items-center bg-surface border border-surface-border p-1 rounded-md">
          <button
            type="button"
            onClick={() => setMediaType('PHOTO')}
            disabled={status === 'uploading'}
            className={cn(
              'px-3 py-1 text-xs font-sans rounded-sm flex items-center gap-1.5 transition-all',
              mediaType === 'PHOTO' ? 'bg-basalt text-bone border border-surface-border font-medium' : 'text-ash hover:text-bone'
            )}
          >
            <Camera className="w-3.5 h-3.5" /> Event Photos (Face Engine)
          </button>
          <button
            type="button"
            onClick={() => setMediaType('CERTIFICATE')}
            disabled={status === 'uploading'}
            className={cn(
              'px-3 py-1 text-xs font-sans rounded-sm flex items-center gap-1.5 transition-all',
              mediaType === 'CERTIFICATE' ? 'bg-basalt text-bone border border-surface-border font-medium' : 'text-ash hover:text-bone'
            )}
          >
            <FileText className="w-3.5 h-3.5" /> Certificates (NLP OCR)
          </button>
        </div>
      </div>

      {status === 'idle' ? (
        <motion.div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileRef.current?.click()}
          animate={{ borderColor: isDragging ? 'rgba(227,165,66,0.5)' : 'rgba(148,140,122,0.2)' }}
          className="w-full border-2 border-dashed rounded-xl p-14 flex flex-col items-center justify-center text-center cursor-pointer transition-colors hover:bg-surface-50 hover:border-ash/40"
          role="button"
          tabIndex={0}
          aria-label="Upload event media"
          onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
        >
          <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-colors', isDragging ? 'bg-seam-gold-muted border border-seam-gold/30' : 'bg-surface border border-surface-border')}>
            <UploadCloud className={cn('w-7 h-7 transition-colors', isDragging ? 'text-seam-gold' : 'text-ash')} />
          </div>
          <p className="font-sans font-medium text-bone mb-1">
            {isDragging ? 'Drop files to upload' : `Upload ${mediaType === 'PHOTO' ? 'Event Photos' : 'Certificates'}`}
          </p>
          <p className="font-sans text-sm text-ash">
            {eventId
              ? 'Drag & drop real files from your computer to store and process via AI'
              : 'Select an event first to upload files'}
          </p>
          <p className="font-mono text-[10px] text-ash/60 mt-3">JPG, PNG, WEBP images up to 50MB</p>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={e => e.target.files?.length && handleFiles(e.target.files)}
          />
        </motion.div>
      ) : (
        <div className="w-full border border-surface-border rounded-xl overflow-hidden bg-surface p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-sans font-medium text-bone text-sm">
                {status === 'uploading' && 'Uploading & Processing Real Media...'}
                {status === 'done' && 'Upload Complete'}
                {status === 'error' && 'Upload Failed'}
              </p>
              <p className="font-mono text-[10px] text-ash mt-0.5">
                {status === 'uploading' && progressText}
                {status === 'done' && `${results.length} file(s) uploaded · ${totalTagsCreated} real student match(es) created`}
                {status === 'error' && errorMsg}
              </p>
            </div>
            {status !== 'uploading' && (
              <button onClick={reset} className="text-ash hover:text-bone transition-colors" aria-label="Reset uploader">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {status === 'uploading' && (
            <div className="h-1.5 bg-basalt rounded-full overflow-hidden">
              <div className="h-full bg-seam-gold rounded-full transition-all duration-300" style={{ width: `${Math.max(10, progressPct)}%` }} />
            </div>
          )}

          {status === 'done' && failedAssets.length > 0 && (
            <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg flex items-start gap-2.5 text-xs text-danger">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Files saved, but AI engine reported error on {failedAssets.length} file(s):</p>
                <p className="font-mono text-[10px] mt-1">{failedAssets[0].processingError}</p>
              </div>
            </div>
          )}

          {status === 'done' && failedAssets.length === 0 && (
            <div className="p-4 bg-verdigris-muted border border-verdigris/20 rounded-lg flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-verdigris shrink-0" />
              <div>
                <p className="font-sans font-medium text-bone text-sm">
                  Processed {results.length} real file(s) — {totalTagsCreated} real match(es) stored
                </p>
                <p className="font-mono text-[10px] text-verdigris mt-0.5">
                  Persisted in PostgreSQL & file storage
                </p>
              </div>
              <Check className="w-4 h-4 text-verdigris ml-auto" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
