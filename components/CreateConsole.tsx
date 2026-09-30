'use client';

import { useState, useEffect, useRef } from 'react';
import { Sparkles, Square, RectangleVertical, RectangleHorizontal, AlertCircle, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import type { GenerationJob } from '@/lib/jobs';

interface CreateConsoleProps {
  creditBalance: number;
  onJobCompleted: (job: GenerationJob) => void;
  onRefreshWallet: () => void;
  initialPrompt?: string;
  initialAspectRatio?: string;
}

export function CreateConsole({
  creditBalance,
  onJobCompleted,
  onRefreshWallet,
  initialPrompt = '',
  initialAspectRatio = '1:1',
}: CreateConsoleProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeJob, setActiveJob] = useState<GenerationJob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [prevPrompt, setPrevPrompt] = useState(initialPrompt);
  const [prevAspect, setPrevAspect] = useState(initialAspectRatio);

  if (initialPrompt !== prevPrompt) {
    setPrevPrompt(initialPrompt);
    setPrompt(initialPrompt);
  }
  if (initialAspectRatio !== prevAspect) {
    setPrevAspect(initialAspectRatio);
    setAspectRatio(initialAspectRatio);
  }

  // Elapsed time counter for active jobs
  useEffect(() => {
    if (!activeJob || (activeJob.state !== 'queued' && activeJob.state !== 'processing')) {
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeJob]);

  // Polling for active job status
  useEffect(() => {
    if (!activeJob || activeJob.state === 'completed' || activeJob.state === 'failed' || activeJob.state === 'cancelled') {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const pollJob = async () => {
      try {
        const res = await fetch(`/api/generations/${activeJob.id}`);
        const data = await res.json();
        if (data.success && data.job) {
          setActiveJob(data.job);
          if (data.job.state === 'completed') {
            onJobCompleted(data.job);
            onRefreshWallet();
          } else if (data.job.state === 'failed' || data.job.state === 'cancelled') {
            onRefreshWallet();
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    pollIntervalRef.current = setInterval(pollJob, 1500);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeJob, onJobCompleted, onRefreshWallet]);

  const handleSubmit = async (e?: React.FormEvent, isRetry = false) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    if (creditBalance < 1 && !isRetry) {
      setErrorMsg('Insufficient credits in demo wallet. Minimum 1 credit required.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    setElapsedSeconds(0);

    try {
      const res = await fetch('/api/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspectRatio,
          forcedFailure: simulateFailure,
          idempotencyKey: crypto.randomUUID(),
          retryParentId: isRetry && activeJob ? activeJob.id : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Failed to submit generation');
      } else {
        setActiveJob(data.job);
        onRefreshWallet();
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || 'Network submission error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    // Disable forced failure for retry so live generation occurs
    setSimulateFailure(false);
    handleSubmit(undefined, true);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Studio Header */}
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl sm:text-4xl text-[var(--text-primary)] font-normal tracking-tight">
          Craft with Precision
        </h1>
        <p className="text-sm text-[var(--text-secondary)] max-w-lg mx-auto leading-relaxed">
          Cloudflare Workers AI FLUX.1 Schnell image generation with bounded 4-step synthesis and verifiable demo credits.
        </p>
      </div>

      {/* Main Form Box */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7 shadow-xs space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Prompt Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="prompt" className="font-medium text-[var(--text-primary)]">
                Creative Prompt
              </label>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                {prompt.length}/2000
              </span>
            </div>
            <textarea
              id="prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your subject in natural daylight, materials, textures, and framing..."
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--canvas)] p-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
              required
            />
            <p className="text-[12px] text-[var(--text-muted)]">
              Short, descriptive prompts produce best results with Schnell.
            </p>
          </div>

          {/* Controls Bar: Aspect Ratio & Failure Simulation */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            {/* Aspect Ratio Selector */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Aspect Ratio</span>
              <div className="flex items-center gap-1.5 p-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]">
                <button
                  type="button"
                  onClick={() => setAspectRatio('1:1')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono font-medium transition-colors ${
                    aspectRatio === '1:1'
                      ? 'bg-[var(--surface)] text-[var(--accent)] shadow-xs font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  aria-pressed={aspectRatio === '1:1'}
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>1:1</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio('9:16')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono font-medium transition-colors ${
                    aspectRatio === '9:16'
                      ? 'bg-[var(--surface)] text-[var(--accent)] shadow-xs font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  aria-pressed={aspectRatio === '9:16'}
                >
                  <RectangleVertical className="h-3.5 w-3.5" />
                  <span>9:16</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio('16:9')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono font-medium transition-colors ${
                    aspectRatio === '16:9'
                      ? 'bg-[var(--surface)] text-[var(--accent)] shadow-xs font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  aria-pressed={aspectRatio === '16:9'}
                >
                  <RectangleHorizontal className="h-3.5 w-3.5" />
                  <span>16:9</span>
                </button>
              </div>
            </div>

            {/* Simulate Next Failure Toggle with MOCK label */}
            <div className="flex items-center gap-3">
              <label
                htmlFor="simulateFailure"
                className="flex items-center gap-2 cursor-pointer select-none text-xs text-[var(--text-secondary)]"
              >
                <input
                  id="simulateFailure"
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                />
                <span className="font-medium">Simulate next failure</span>
                <span className="rounded bg-[var(--badge-mock-bg)] border border-pink-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--badge-mock)] uppercase tracking-wider">
                  MOCK
                </span>
              </label>
            </div>
          </div>

          {/* Action Row: Error Display & Generate Button */}
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--error-bg)] border border-red-200 p-3 text-xs text-[var(--error)]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)] font-mono">
              Balance: <strong className="text-[var(--text-primary)]">{creditBalance}</strong> credits
            </span>

            <button
              type="submit"
              disabled={isSubmitting || !prompt.trim()}
              className="inline-flex items-center gap-2.5 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Sparkles className="h-4 w-4" />
              <span>Generate · 1 credit</span>
            </button>
          </div>
        </form>
      </div>

      {/* Active Job Timeline Card */}
      {activeJob && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Generation Pipeline
              </span>
              <span className="font-mono text-xs text-[var(--text-muted)]">#{activeJob.id.slice(0, 8)}</span>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--text-muted)]">
              <Clock className="h-3.5 w-3.5" />
              <span>{elapsedSeconds}s elapsed</span>
            </div>
          </div>

          {/* 3-Step Timeline Progression */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            {/* Step 1: Queued */}
            <div
              className={`rounded-lg p-3 text-xs border transition-colors ${
                activeJob.state === 'queued'
                  ? 'border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--canvas)] text-[var(--text-secondary)]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">1. Queued</span>
                {activeJob.state !== 'queued' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
              </div>
              <span className="font-mono text-[10px] text-[var(--text-muted)] block truncate">
                {new Date(activeJob.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            {/* Step 2: Processing */}
            <div
              className={`rounded-lg p-3 text-xs border transition-colors ${
                activeJob.state === 'processing'
                  ? 'border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)] animate-pulse'
                  : activeJob.started_at
                  ? 'border-[var(--border)] bg-[var(--canvas)] text-[var(--text-secondary)]'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">2. Processing</span>
                {activeJob.completed_at && activeJob.state === 'completed' && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                )}
              </div>
              <span className="font-mono text-[10px] text-[var(--text-muted)] block truncate">
                {activeJob.started_at
                  ? new Date(activeJob.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : 'Awaiting claim'}
              </span>
            </div>

            {/* Step 3: Completed / Failed */}
            <div
              className={`rounded-lg p-3 text-xs border transition-colors ${
                activeJob.state === 'completed'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : activeJob.state === 'failed'
                  ? 'border-rose-500 bg-rose-50 text-rose-800'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">
                  {activeJob.state === 'failed' ? '3. Failed' : '3. Complete'}
                </span>
                {activeJob.state === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                {activeJob.state === 'failed' && <AlertCircle className="h-3.5 w-3.5 text-rose-600" />}
              </div>
              <span className="font-mono text-[10px] text-[var(--text-muted)] block truncate">
                {activeJob.completed_at
                  ? new Date(activeJob.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : 'Awaiting synthesis'}
              </span>
            </div>
          </div>

          {/* Prompt recap */}
          <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">Prompt: </span>
            <span>&ldquo;{activeJob.prompt}&rdquo;</span>
          </div>

          {/* Failure Resolution and Idempotent Refund Notice */}
          {activeJob.state === 'failed' && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-rose-900">
                    {activeJob.safe_error_summary || 'Generation encountered an error.'}
                  </p>
                  <p className="text-rose-700">
                    Your wallet was not charged. An idempotent refund of +1 demo credit has been recorded in your ledger.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-rose-200/60">
                <span className="font-mono text-[11px] text-emerald-800 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded">
                  +1 Refund Applied
                </span>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface)] border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-900 shadow-xs hover:bg-rose-100 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Retry Live Generation</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
