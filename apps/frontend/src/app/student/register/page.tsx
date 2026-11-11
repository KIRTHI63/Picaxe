'use client';
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Button';
import { MatchHighlight } from '@/components/MatchHighlight';
import { useToast } from '@/components/ui/Toast';
import { UploadCloud, ScanFace, ArrowRight, RefreshCw, AlertCircle, LogIn } from 'lucide-react';
import { api, getToken, getStoredUser } from '@/lib/api';

export default function StudentRegister() {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [feedbackLine, setFeedbackLine] = useState('Waiting for photo upload...');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const token = getToken();
    const user = getStoredUser();
    setIsAuthenticated(Boolean(token && user));
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setStatus('idle');
      setErrorDetail(null);
      setFeedbackLine(`Selected: ${file.name} · Click "Upload & Register Biometrics"`);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      triggerFileInput();
      return;
    }

    setStatus('uploading');
    setErrorDetail(null);
    setFeedbackLine('Validating single face, quality, and extracting 512-D ArcFace vector...');

    try {
      const res = await api.students.registerFace(selectedFile);
      setStatus('success');
      const qScore = res.quality?.score != null ? `Quality: ${Math.round(res.quality.score * 100)}%` : '';
      setFeedbackLine(`Face verified · ${qScore} · Indexed in Qdrant (${res.qdrantPointId.slice(0, 8)}...)`);
      toast({
        type: 'success',
        title: 'Identity registered',
        description: 'Your real 512-D ArcFace vector has been saved to Qdrant.',
      });
    } catch (err: any) {
      const msg = err?.message || 'Face registration failed';
      setStatus('error');
      setErrorDetail(msg);
      setFeedbackLine(`Registration rejected: ${msg}`);
      toast({
        type: 'error',
        title: 'Face registration failed',
        description: msg,
      });
    }
  };

  const reset = () => {
    setStatus('idle');
    setErrorDetail(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setFeedbackLine('Waiting for photo upload...');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-dvh flex flex-col bg-basalt">
      <Navbar context="student" />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md flex flex-col items-center text-center gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="font-sans font-semibold text-3xl text-bone tracking-tight">Register Your Face</h1>
            <p className="font-sans text-sm text-ash">
              Upload one clear portrait photo. InsightFace validates single-face quality and indexes your 512-D vector in Qdrant.
            </p>
          </div>

          {!isAuthenticated && (
            <div className="w-full card p-4 border-seam-gold/30 flex items-center justify-between gap-3 text-left">
              <div className="text-xs font-sans text-bone">Sign in as a Student first to register biometrics.</div>
              <Link href="/auth?role=STUDENT&next=/student/register">
                <Button variant="primary" size="sm" icon={<LogIn className="w-3.5 h-3.5" />}>Sign In</Button>
              </Link>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileSelect}
          />

          <div className="relative flex flex-col items-center">
            <MatchHighlight isMatched={status === 'success'} className="rounded-full">
              <div
                onClick={status !== 'uploading' ? triggerFileInput : undefined}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && status !== 'uploading' && triggerFileInput()}
                aria-label="Select face photo to upload"
                className={`relative w-60 h-60 rounded-full border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all cursor-pointer select-none
                  ${status === 'success'
                    ? 'border-verdigris bg-verdigris-muted/20'
                    : status === 'error'
                    ? 'border-danger/60 bg-danger/10'
                    : status === 'uploading'
                    ? 'border-seam-gold/60 bg-seam-gold-muted/10'
                    : 'border-ash/30 hover:border-seam-gold/50 hover:bg-surface-50 bg-surface'
                  }`}
              >
                {previewUrl && (
                  <img src={previewUrl} alt="Selected face" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                )}

                {status === 'idle' && !previewUrl && (
                  <div className="flex flex-col items-center gap-3 z-10 p-6">
                    <UploadCloud className="w-8 h-8 text-ash" />
                    <span className="font-sans text-xs text-ash">Click to select photo</span>
                  </div>
                )}

                {status === 'idle' && previewUrl && (
                  <div className="z-10 bg-basalt/70 px-3 py-1 rounded-full border border-surface-border backdrop-blur-sm">
                    <span className="font-mono text-[10px] text-bone">Click to change photo</span>
                  </div>
                )}

                {status === 'uploading' && (
                  <motion.div
                    initial={{ top: '0%' }}
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    className="absolute inset-x-0 h-0.5 bg-seam-gold shadow-gold z-20"
                  />
                )}

                {status === 'uploading' && (
                  <ScanFace className="w-10 h-10 text-seam-gold animate-pulse z-10 bg-basalt/50 p-2 rounded-full" />
                )}

                {status === 'success' && (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-2 z-10 bg-basalt/70 px-4 py-2 rounded-xl backdrop-blur-sm">
                    <div className="w-8 h-8 rounded-full bg-verdigris flex items-center justify-center text-basalt font-bold text-sm">✓</div>
                    <span className="font-mono text-xs text-verdigris font-medium">Verified</span>
                  </motion.div>
                )}

                {status === 'error' && (
                  <div className="flex flex-col items-center gap-2 z-10 bg-basalt/80 px-4 py-2 rounded-xl">
                    <AlertCircle className="w-7 h-7 text-danger" />
                    <span className="font-mono text-[11px] text-danger font-medium">Rejected</span>
                  </div>
                )}
              </div>
            </MatchHighlight>

            <AnimatePresence mode="wait">
              <motion.p
                key={feedbackLine}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={`mt-5 font-mono text-xs ${
                  status === 'success' ? 'text-verdigris' : status === 'error' ? 'text-danger' : 'text-ash'
                }`}
              >
                {feedbackLine}
              </motion.p>
            </AnimatePresence>
            {errorDetail && (
              <p className="mt-2 font-sans text-xs text-ash max-w-sm">
                Make sure the Face Engine (:8000) and Backend (:3001) are running, and upload a well-lit single-person portrait.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 w-full">
            {status !== 'success' && (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  loading={status === 'uploading'}
                  onClick={handleUpload}
                  className="w-full"
                  disabled={!isAuthenticated}
                >
                  {!selectedFile ? 'Choose Photo from Computer' : status === 'uploading' ? 'Running Face Engine...' : 'Upload & Register Biometrics'}
                </Button>
                {selectedFile && status !== 'uploading' && (
                  <Button variant="ghost" size="sm" onClick={reset} icon={<RefreshCw className="w-3.5 h-3.5" />}>
                    Clear photo
                  </Button>
                )}
              </>
            )}

            {status === 'success' && (
              <>
                <Link href="/student" className="w-full">
                  <Button variant="primary" size="lg" className="w-full gap-2">
                    Go to Dashboard <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={reset} icon={<RefreshCw className="w-3.5 h-3.5" />}>
                  Re-register photo
                </Button>
              </>
            )}
          </div>

          <p className="font-mono text-[10px] text-ash/60 uppercase tracking-wider leading-relaxed max-w-xs">
            Encrypted 512-D ArcFace vector indexed in Qdrant · Real quality gate enforced
          </p>
        </div>
      </main>
    </div>
  );
}
