'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, LogIn, LogOut } from 'lucide-react';
import { api, getStoredUser, AuthUser } from '@/lib/api';

interface NavbarProps {
  context?: 'student' | 'organization' | 'admin' | 'public';
  className?: string;
}

export function Navbar({ context = 'public', className }: NavbarProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    sync();
    window.addEventListener('picaxe_auth_changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('picaxe_auth_changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const handleLogout = () => {
    api.auth.logout();
    router.push('/auth');
  };

  const labels = { student: 'Student', organization: 'Organization', admin: 'Admin Console', public: '' };
  const contextLabel = labels[context];

  return (
    <header className={cn(
      'w-full h-14 flex items-center justify-between px-6 border-b border-surface-border sticky top-0 z-50 backdrop-blur-md',
      context === 'admin' ? 'bg-surface/95' : 'bg-basalt/90',
      className
    )}>
      <Link href="/" className="flex items-center gap-2.5 font-sans font-semibold text-bone hover:opacity-80 transition-opacity" aria-label="Picaxe home">
        <PicaxeMark />
        <span className="tracking-tight">Picaxe</span>
        {contextLabel && (
          <span className="font-mono text-[10px] text-ash uppercase tracking-widest pl-2 border-l border-ash/20 ml-1">
            {contextLabel}
          </span>
        )}
      </Link>

      <nav className="flex items-center gap-5 font-sans text-sm text-ash">
        {context === 'public' && (
          <div className="hidden md:flex items-center gap-6">
            <Link href="/student" className="hover:text-bone transition-colors">Students</Link>
            <Link href="/organization" className="hover:text-bone transition-colors">Organizations</Link>
            <Link href="/admin" className="hover:text-bone transition-colors">Admin</Link>
          </div>
        )}

        {context === 'student' && (
          <Link href="/student" className="hover:text-bone transition-colors hidden sm:block">Dashboard</Link>
        )}
        {context === 'organization' && (
          <Link href="/organization" className="hover:text-bone transition-colors hidden sm:block">Dashboard</Link>
        )}

        {context !== 'public' && (
          <Link href="/" className="flex items-center gap-1.5 hover:text-bone transition-colors text-xs">
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Home</span>
          </Link>
        )}

        {user ? (
          <div className="flex items-center gap-3 pl-3 border-l border-surface-border">
            <span className="font-mono text-[11px] text-bone hidden sm:inline">
              {user.displayName || user.email}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-xs text-ash hover:text-bone transition-colors cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        ) : (
          <Link
            href="/auth"
            className="flex items-center gap-1.5 text-xs text-seam-gold hover:text-bone transition-colors font-medium"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Link>
        )}
      </nav>
    </header>
  );
}

export function PicaxeMark({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 16 16"
      fill="none" aria-hidden="true"
      className={className}
    >
      <rect x="0" y="0" width="6" height="6" rx="1.5" fill="currentColor" className="text-seam-gold" />
      <rect x="10" y="0" width="6" height="6" rx="1.5" fill="currentColor" className="text-seam-gold opacity-60" />
      <rect x="0" y="10" width="6" height="6" rx="1.5" fill="currentColor" className="text-seam-gold opacity-60" />
      <rect x="10" y="10" width="6" height="6" rx="1.5" fill="currentColor" className="text-verdigris" />
    </svg>
  );
}
