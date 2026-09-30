'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Coins, Sparkles, Image as ImageIcon } from 'lucide-react';

interface NavbarProps {
  creditBalance: number;
  onOpenLedger: () => void;
}

export function Navbar({ creditBalance, onOpenLedger }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[var(--canvas)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="group flex items-baseline gap-2">
            <span className="font-serif text-2xl font-normal tracking-tight text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
              Atelier
            </span>
            <span className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide uppercase text-[var(--text-secondary)]">
              Studio
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden sm:flex items-center gap-1 pl-4 border-l border-[var(--border)]">
            <Link
              href="/"
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                pathname === '/'
                  ? 'bg-[var(--accent-light)] text-[var(--accent)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>Studio</span>
            </Link>
            <Link
              href="/assets"
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                pathname === '/assets'
                  ? 'bg-[var(--accent-light)] text-[var(--accent)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'
              }`}
            >
              <ImageIcon className="h-4 w-4" />
              <span>Library</span>
            </Link>
          </nav>

          {/* Mobile Navigation Icons */}
          <nav className="flex sm:hidden items-center gap-1">
            <Link
              href="/"
              className={`flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-sm font-medium transition-colors ${
                pathname === '/'
                  ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'
              }`}
              aria-label="Studio"
            >
              <Sparkles className="h-4 w-4" />
            </Link>
            <Link
              href="/assets"
              className={`flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-sm font-medium transition-colors ${
                pathname === '/assets'
                  ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]'
              }`}
              aria-label="Library"
            >
              <ImageIcon className="h-4 w-4" />
            </Link>
          </nav>
        </div>

        {/* Right Controls: User Identity & Credit Ledger Pill */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono">
            <span>demo_creator</span>
            <span className="text-[var(--border)]">·</span>
          </div>

          <button
            onClick={onOpenLedger}
            type="button"
            className="group flex items-center gap-2 rounded-full border border-[var(--accent-border)] bg-[var(--accent-light)] px-3 py-1.5 text-xs font-mono font-medium text-[var(--accent)] shadow-xs transition-all hover:bg-[var(--accent)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
            title="View demo credit balance and transaction ledger"
            aria-label="View demo credit ledger"
          >
            <Coins className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
            <span className="tabular-nums font-semibold">{creditBalance}</span>
            <span className="opacity-90">credits</span>
          </button>
        </div>
      </div>
    </header>
  );
}
