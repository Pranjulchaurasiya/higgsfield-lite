'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { AssetsGrid, AssetItem } from '@/components/AssetsGrid';
import { LedgerDrawer } from '@/components/LedgerDrawer';
import type { CreditTransaction } from '@/lib/credits';

export default function LibraryPage() {
  const router = useRouter();
  const [balance, setBalance] = useState(10);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [credRes, assetRes] = await Promise.all([
          fetch('/api/credits').then((r) => r.json()),
          fetch('/api/assets').then((r) => r.json()),
        ]);
        if (active) {
          if (credRes?.success) {
            setBalance(credRes.balance);
            setTransactions(credRes.transactions || []);
          }
          if (assetRes?.success) {
            setAssets(assetRes.assets || []);
          }
        }
      } catch (err) {
        console.error('Initial fetch failed:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleRemix = (prompt: string, aspectRatio: string) => {
    // Navigate to Studio and pass prompt in search params
    const query = new URLSearchParams({ prompt, aspect: aspectRatio }).toString();
    router.push(`/?${query}`);
  };

  const handleDeleteAsset = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--canvas)]">
      <Navbar creditBalance={balance} onOpenLedger={() => setIsLedgerOpen(true)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[var(--text-primary)] font-normal tracking-tight">
            Library Archive
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            All persisted creations, metadata, and export tools.
          </p>
        </div>

        <AssetsGrid
          assets={assets}
          onRemix={handleRemix}
          onDeleteAsset={handleDeleteAsset}
          isLoading={isLoading}
        />
      </main>

      <LedgerDrawer
        isOpen={isLedgerOpen}
        onClose={() => setIsLedgerOpen(false)}
        balance={balance}
        transactions={transactions}
      />
    </div>
  );
}
