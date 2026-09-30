'use client';

import { useState, useEffect, useRef } from 'react';
import { Sparkles, Square, RectangleVertical, RectangleHorizontal, AlertCircle, RefreshCw, CheckCircle2, Clock, Dices, X, Eye, Download, Copy, Check } from 'lucide-react';
import type { GenerationJob } from '@/lib/jobs';
import { ImageLightboxModal } from './ImageLightboxModal';
import type { AssetItem } from './AssetsGrid';

interface CreateConsoleProps {
  creditBalance: number;
  onJobCompleted: (job: GenerationJob) => void;
  onRefreshWallet: () => void;
  initialPrompt?: string;
  initialAspectRatio?: string;
}

const INSPIRATION_PROMPTS = [
  {
    label: '🪐 Deep Space',
    prompt: 'Atmospheric deep space observatory illuminated by vibrant nebular aurora, golden hour rim lighting, 8k cinematic render',
    aspect: '16:9',
  },
  {
    label: '🏛️ Brutalist Kyoto',
    prompt: 'Brutalist concrete and smoked glass pavilion reflecting in rain puddles, hyper-detailed minimalist Kyoto zen architecture, 35mm film',
    aspect: '1:1',
  },
  {
    label: '🐆 Cyberpunk Rooftop',
    prompt: 'Sleek cybernetic snow leopard pacing on neon-lit wet glass rooftop overlooking futuristic Tokyo skyline at night, cinematic photorealism',
    aspect: '9:16',
  },
  {
    label: '🎨 Editorial Portrait',
    prompt: 'Editorial portrait of an artisan ceramicist in sunlit Parisian loft studio, textured clay dust in air, natural chiaroscuro lighting, medium format',
    aspect: '1:1',
  },
  {
    label: '🌿 Bioluminescent Glass',
    prompt: 'Futuristic curved botanical greenhouse interior filled with glowing bioluminescent tropical flora against dark snowy Nordic forest',
    aspect: '16:9',
  },
];

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
  const [lightboxAsset, setLightboxAsset] = useState<AssetItem | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

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
    setSimulateFailure(false);
    handleSubmit(undefined, true);
  };

  const handleSurpriseMe = () => {
    const randomIndex = Math.floor(Math.random() * INSPIRATION_PROMPTS.length);
    const item = INSPIRATION_PROMPTS[randomIndex];
    setPrompt(item.prompt);
    setAspectRatio(item.aspect);
  };

  const handleSelectInspiration = (item: (typeof INSPIRATION_PROMPTS)[0]) => {
    setPrompt(item.prompt);
    setAspectRatio(item.aspect);
  };

  const handleCopyConsolePrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <>
      <div className="w-full max-w-3xl mx-auto space-y-6">
        {/* Studio Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-mono text-[var(--accent)] mb-1 shadow-2xs">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Cloudflare Workers AI · FLUX.1-schnell</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[var(--text-primary)] font-normal tracking-tight">
            Craft with Precision
          </h1>
          <p className="text-sm text-[var(--text-secondary)] max-w-lg mx-auto leading-relaxed">
            High-fidelity generative studio with verifiable transactional credit ledger and native Model Context Protocol support.
          </p>
        </div>

        {/* Main Form Box */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7 shadow-xs space-y-5">
          {/* Inspiration Prompts Chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-[var(--accent)]" />
                Prompt Inspiration
              </span>
              <button
                type="button"
                onClick={handleSurpriseMe}
                className="flex items-center gap-1 font-mono text-[11px] text-[var(--accent)] hover:underline"
              >
                <Dices className="h-3.5 w-3.5" />
                <span>Surprise Me</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {INSPIRATION_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleSelectInspiration(item)}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-border)] hover:bg-[var(--surface)] transition-all font-sans"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Prompt Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="prompt" className="font-medium text-[var(--text-primary)]">
                  Creative Prompt
                </label>
                <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--text-muted)]">
                  {prompt && (
                    <button
                      type="button"
                      onClick={() => setPrompt('')}
                      className="hover:text-[var(--text-primary)] flex items-center gap-0.5"
                    >
                      <X className="h-3 w-3" />
                      <span>Clear</span>
                    </button>
                  )}
                  <span>{prompt.length}/2000</span>
                </div>
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
                Descriptive physical details (light, environment, lens) yield best results with FLUX Schnell.
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
                    : 'Synthesizing pixels'}
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
                    : 'Awaiting completion'}
                </span>
              </div>
            </div>

            {/* Prompt recap */}
            <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--text-primary)]">Prompt: </span>
              <span>&ldquo;{activeJob.prompt}&rdquo;</span>
            </div>

            {/* Finished Generation Result Card */}
            {activeJob.state === 'completed' && activeJob.asset && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-mono font-medium text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Generation Finished
                  </span>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    {activeJob.asset.width}x{activeJob.asset.height} px
                  </span>
                </div>

                <div className="relative group rounded-lg overflow-hidden border border-[var(--border)] bg-black/20 flex items-center justify-center max-h-[360px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeJob.asset.data_url || activeJob.asset.storage_object_key}
                    alt={activeJob.prompt}
                    className="max-h-[340px] w-auto object-contain cursor-pointer transition-transform group-hover:scale-[1.02]"
                    onClick={() => {
                      if (activeJob.asset) {
                        setLightboxAsset({
                          id: activeJob.asset.id,
                          job_id: activeJob.id,
                          storage_object_key: activeJob.asset.storage_object_key,
                          prompt: activeJob.prompt,
                          aspect_ratio: activeJob.aspect_ratio,
                          width: activeJob.asset.width,
                          height: activeJob.asset.height,
                          is_sample: activeJob.asset.is_sample,
                          url: activeJob.asset.data_url || activeJob.asset.storage_object_key,
                          created_at: activeJob.completed_at || activeJob.created_at,
                        });
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity pointer-events-none">
                    <span className="flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs font-mono text-white">
                      <Eye className="h-3.5 w-3.5" />
                      Click to inspect
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeJob.asset) {
                        setLightboxAsset({
                          id: activeJob.asset.id,
                          job_id: activeJob.id,
                          storage_object_key: activeJob.asset.storage_object_key,
                          prompt: activeJob.prompt,
                          aspect_ratio: activeJob.aspect_ratio,
                          width: activeJob.asset.width,
                          height: activeJob.asset.height,
                          is_sample: activeJob.asset.is_sample,
                          url: activeJob.asset.data_url || activeJob.asset.storage_object_key,
                          created_at: activeJob.completed_at || activeJob.created_at,
                        });
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs font-mono text-[var(--accent)] hover:underline"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Open in Inspector</span>
                  </button>

                  <a
                    href={activeJob.asset.data_url || activeJob.asset.storage_object_key}
                    download={`atelier-${activeJob.id}.png`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-mono text-[var(--text-primary)] hover:border-[var(--accent-border)] transition-colors shadow-2xs"
                  >
                    <Download className="h-3.5 w-3.5 text-[var(--accent)]" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            )}

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

      <ImageLightboxModal
        asset={lightboxAsset}
        onClose={() => setLightboxAsset(null)}
        onRemix={(p, a) => {
          setPrompt(p);
          setAspectRatio(a);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </>
  );
}
