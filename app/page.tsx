'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { CreateConsole } from '@/components/CreateConsole';
import { AssetsGrid, AssetItem } from '@/components/AssetsGrid';
import { LedgerDrawer } from '@/components/LedgerDrawer';
import type { CreditTransaction } from '@/lib/credits';

export default function StudioPage() {
  const [balance, setBalance] = useState(10);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);

  // Remix state passed to CreateConsole
  const [remixPrompt, setRemixPrompt] = useState<string>('');
  const [remixAspect, setRemixAspect] = useState<string>('1:1');

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch('/api/credits');
      const data = await res.json();
      if (data.success) {
        setBalance(data.balance);
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error('Error fetching credits:', err);
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      setIsLoadingAssets(true);
      const res = await fetch('/api/assets');
      const data = await res.json();
      if (data.success) {
        setAssets(data.assets || []);
      }
    } catch (err) {
      console.error('Error fetching assets:', err);
    } finally {
      setIsLoadingAssets(false);
    }
  }, []);

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
        console.error(err);
      } finally {
        if (active) setIsLoadingAssets(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleJobCompleted = () => {
    fetchCredits();
    fetchAssets();
  };

  const handleRemix = (prompt: string, aspectRatio: string) => {
    setRemixPrompt(prompt);
    setRemixAspect(aspectRatio);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteAsset = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--canvas)]">
      <Navbar creditBalance={balance} onOpenLedger={() => setIsLedgerOpen(true)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12 sm:space-y-16">
        {/* Studio Create Section */}
        <section aria-labelledby="studio-heading">
          <CreateConsole
            creditBalance={balance}
            onJobCompleted={handleJobCompleted}
            onRefreshWallet={fetchCredits}
            initialPrompt={remixPrompt}
            initialAspectRatio={remixAspect}
          />
        </section>

        {/* Recent Assets Gallery Section */}
        <section aria-labelledby="archive-heading" className="pt-6 border-t border-[var(--border)]">
          <AssetsGrid
            assets={assets}
            onRemix={handleRemix}
            onDeleteAsset={handleDeleteAsset}
            isLoading={isLoadingAssets}
          />
        </section>
      </main>

      {/* Credit Ledger Drawer */}
      <LedgerDrawer
        isOpen={isLedgerOpen}
        onClose={() => setIsLedgerOpen(false)}
        balance={balance}
        transactions={transactions}
      />
    </div>
  );
}
