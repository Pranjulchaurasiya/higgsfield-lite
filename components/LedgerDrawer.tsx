'use client';

import { X, ArrowDownRight, ArrowUpRight, ShieldCheck, History } from 'lucide-react';
import type { CreditTransaction } from '@/lib/credits';

interface LedgerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  transactions: CreditTransaction[];
}

export function LedgerDrawer({ isOpen, onClose, balance, transactions }: LedgerDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/30 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md bg-[var(--surface)] border-l border-[var(--border)] shadow-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5 bg-[var(--canvas)]">
            <div className="flex items-center gap-2.5">
              <History className="h-5 w-5 text-[var(--accent)]" />
              <h2 className="font-serif text-lg font-medium text-[var(--text-primary)]">
                Credit Ledger
              </h2>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="rounded-md p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              aria-label="Close drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Balance Summary Card */}
          <div className="p-6 border-b border-[var(--border)] bg-gradient-to-b from-[var(--canvas)] to-[var(--surface)]">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs">
              <span className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
                Available Wallet Balance
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-semibold text-[var(--text-primary)]">
                  {balance}
                </span>
                <span className="text-sm font-medium text-[var(--text-secondary)]">demo credits</span>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-md bg-[var(--surface-muted)] p-2.5 text-xs text-[var(--text-secondary)]">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <span>1 image = 1 internal credit. Automatic idempotent refund on failure.</span>
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--border-subtle)]">
              <span className="font-mono text-xs font-semibold uppercase text-[var(--text-muted)]">
                Audit Trail ({transactions.length})
              </span>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">Immutable Ledger</span>
            </div>

            {transactions.length === 0 ? (
              <div className="py-12 text-center text-sm text-[var(--text-muted)]">
                No transactions recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx, index) => {
                  const isRefund = tx.transaction_type === 'refund';
                  const isReserve = tx.transaction_type === 'reserve';

                  return (
                    <div
                      key={`${tx.id}-${index}`}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5 text-xs transition-colors hover:border-[var(--accent-border)]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[11px] font-medium uppercase ${
                              isRefund
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isReserve
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-stone-100 text-stone-700 border border-stone-200'
                            }`}
                          >
                            {isRefund && <ArrowUpRight className="h-3 w-3" />}
                            {isReserve && <ArrowDownRight className="h-3 w-3" />}
                            {tx.transaction_type}
                          </span>
                          <span className="text-[var(--text-secondary)] font-medium">
                            {tx.description || tx.transaction_type}
                          </span>
                        </div>
                        <span
                          className={`font-mono font-semibold tabular-nums text-sm ${
                            tx.amount > 0 ? 'text-emerald-700' : 'text-stone-800'
                          }`}
                        >
                          {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                        </span>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] pt-2 border-t border-[var(--border-subtle)]">
                        <span>{new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        {tx.job_id && (
                          <span className="truncate max-w-[140px]" title={tx.job_id}>
                            job: {tx.job_id.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="border-t border-[var(--border)] p-4 bg-[var(--canvas)] text-center text-xs text-[var(--text-muted)] font-mono">
            Demo wallet seeded with 10 internal credits. No real currency.
          </div>
        </div>
      </div>
    </div>
  );
}
