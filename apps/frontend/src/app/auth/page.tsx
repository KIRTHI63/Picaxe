'use client';
import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { UserCheck, Building2, LogIn, UserPlus } from 'lucide-react';

function AuthFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') === 'ORGANIZATION' ? 'ORGANIZATION' : 'STUDENT';
  const nextPath = searchParams.get('next');
  const { toast } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'STUDENT' | 'ORGANIZATION'>(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const redirectAfterAuth = (userRole: string) => {
    if (nextPath) {
      router.push(nextPath);
      return;
    }
    if (userRole === 'ORGANIZATION') router.push('/organization');
    else if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') router.push('/admin');
    else router.push('/student');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await api.auth.login({ email: email.trim(), password });
        toast({
          type: 'success',
          title: 'Signed in',
          description: `Welcome back, ${res.user.displayName || res.user.email}.`,
        });
        redirectAfterAuth(res.user.role);
      } else {
        const res = await api.auth.register({
          email: email.trim(),
          password,
          name: name.trim(),
          institution: institution.trim() || undefined,
          role,
          organizationName: role === 'ORGANIZATION' ? organizationName.trim() || undefined : undefined,
        });
        toast({
          type: 'success',
          title: 'Account created',
          description: `Signed in as ${res.user.displayName}.`,
        });
        redirectAfterAuth(res.user.role);
      }
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed';
      setErrorMsg(msg);
      toast({ type: 'error', title: 'Authentication error', description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-basalt">
      <Navbar context="public" />
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md card p-6 md:p-8 flex flex-col gap-6">
          <div>
            <h1 className="font-sans font-semibold text-2xl text-bone">
              {mode === 'login' ? 'Sign in to Picaxe' : 'Create a Picaxe account'}
            </h1>
            <p className="font-sans text-sm text-ash mt-1">
              Authenticate against the live database to access real events and biometric matching.
            </p>
          </div>

          <div className="flex bg-basalt border border-surface-border rounded-md p-1">
            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMsg(null); }}
              className={`flex-1 py-2 text-xs font-sans rounded-sm transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'login' ? 'bg-surface text-bone border border-surface-border font-medium' : 'text-ash hover:text-bone'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setErrorMsg(null); }}
              className={`flex-1 py-2 text-xs font-sans rounded-sm transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'register' ? 'bg-surface text-bone border border-surface-border font-medium' : 'text-ash hover:text-bone'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Create Account
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-danger text-xs font-sans">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] text-ash uppercase tracking-widest">Account Type</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('STUDENT')}
                      className={`p-3 rounded-md border text-left transition-colors flex items-center gap-2 ${
                        role === 'STUDENT'
                          ? 'bg-seam-gold/10 border-seam-gold text-bone'
                          : 'bg-basalt border-surface-border text-ash hover:text-bone'
                      }`}
                    >
                      <UserCheck className="w-4 h-4 shrink-0" />
                      <span className="font-sans text-xs font-medium">Student</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('ORGANIZATION')}
                      className={`p-3 rounded-md border text-left transition-colors flex items-center gap-2 ${
                        role === 'ORGANIZATION'
                          ? 'bg-seam-gold/10 border-seam-gold text-bone'
                          : 'bg-basalt border-surface-border text-ash hover:text-bone'
                      }`}
                    >
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span className="font-sans text-xs font-medium">Organization</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="auth-name" className="font-mono text-[10px] text-ash uppercase tracking-widest">
                    Full Name *
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Exact name (used for certificate matching)"
                    className="w-full bg-basalt border border-surface-border rounded-md px-3 py-2.5 text-sm text-bone outline-none focus:border-seam-gold/50"
                  />
                </div>

                {role === 'ORGANIZATION' ? (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="auth-org" className="font-mono text-[10px] text-ash uppercase tracking-widest">
                      Organization Name
                    </label>
                    <input
                      id="auth-org"
                      type="text"
                      value={organizationName}
                      onChange={e => setOrganizationName(e.target.value)}
                      placeholder="e.g. Computer Science Club"
                      className="w-full bg-basalt border border-surface-border rounded-md px-3 py-2.5 text-sm text-bone outline-none focus:border-seam-gold/50"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="auth-inst" className="font-mono text-[10px] text-ash uppercase tracking-widest">
                      Institution
                    </label>
                    <input
                      id="auth-inst"
                      type="text"
                      value={institution}
                      onChange={e => setInstitution(e.target.value)}
                      placeholder="e.g. University Tech"
                      className="w-full bg-basalt border border-surface-border rounded-md px-3 py-2.5 text-sm text-bone outline-none focus:border-seam-gold/50"
                    />
                  </div>
                )}
              </>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-email" className="font-mono text-[10px] text-ash uppercase tracking-widest">
                Email *
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@university.edu"
                className="w-full bg-basalt border border-surface-border rounded-md px-3 py-2.5 text-sm text-bone outline-none focus:border-seam-gold/50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-password" className="font-mono text-[10px] text-ash uppercase tracking-widest">
                Password * {mode === 'register' && '(min 8 chars)'}
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={mode === 'register' ? 8 : 1}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-basalt border border-surface-border rounded-md px-3 py-2.5 text-sm text-bone outline-none focus:border-seam-gold/50"
              />
            </div>

            <Button type="submit" variant="primary" size="md" loading={loading} className="mt-2">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <p className="text-center font-mono text-[10px] text-ash">
            <Link href="/" className="hover:text-bone underline">Back to Home</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-basalt" />}>
      <AuthFormInner />
    </Suspense>
  );
}
