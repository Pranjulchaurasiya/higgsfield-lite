'use client';

import { useState } from 'react';
import { X, Download, Copy, Check, Sparkles, ExternalLink, Calendar, Maximize2 } from 'lucide-react';
import type { AssetItem } from './AssetsGrid';

interface ImageLightboxModalProps {
  asset: AssetItem | null;
  onClose: () => void;
  onRemix?: (prompt: string, aspectRatio: string) => void;
}

export function ImageLightboxModal({ asset, onClose, onRemix }: ImageLightboxModalProps) {
  const [copied, setCopied] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  if (!asset) return null;

  const imageUrl = asset.url || `/api/assets/${asset.id}/download`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(asset.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `atelier-${asset.id}.png`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRemixClick = () => {
    if (onRemix) {
      onRemix(asset.prompt, asset.aspect_ratio);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl flex flex-col md:flex-row"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-modal-title"
      >
        {/* Close Button Mobile/Top Right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 rounded-full bg-black/60 p-2 text-white/80 hover:bg-black hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Left: Image Canvas */}
        <div className="relative flex-1 bg-black/40 flex items-center justify-center p-4 min-h-[300px] md:min-h-[500px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={asset.prompt}
            onClick={() => setIsZoomed(!isZoomed)}
            className={`max-h-[75vh] w-auto object-contain rounded-lg transition-transform duration-300 cursor-zoom-in ${
              isZoomed ? 'scale-125 cursor-zoom-out' : 'hover:scale-[1.01]'
            }`}
          />
          <div className="absolute bottom-4 left-4 flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-mono font-medium shadow-xs ${
                asset.is_sample
                  ? 'border border-amber-500/40 bg-amber-500/20 text-amber-300'
                  : 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {asset.is_sample ? 'SAMPLE FIXTURE' : 'LIVE FLUX INFERENCE'}
            </span>
            <span className="rounded-full bg-black/60 backdrop-blur-xs px-2.5 py-0.5 text-[11px] font-mono text-white/80">
              {asset.aspect_ratio} ({asset.width}x{asset.height})
            </span>
          </div>
        </div>

        {/* Right: Metadata & Actions Panel */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-[var(--border)] p-6 flex flex-col justify-between space-y-6 bg-[var(--surface)]">
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Generation Prompt
              </span>
              <p id="image-modal-title" className="mt-1 text-sm font-serif text-[var(--text-primary)] leading-relaxed italic">
                &ldquo;{asset.prompt}&rdquo;
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-[var(--border)] text-xs text-[var(--text-secondary)] font-mono">
              <div className="flex items-center justify-between">
                <span>Created</span>
                <span className="flex items-center gap-1 text-[var(--text-primary)]">
                  <Calendar className="h-3 w-3" />
                  {new Date(asset.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Model Engine</span>
                <span className="text-[var(--text-primary)]">FLUX.1-schnell</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Aspect Crop</span>
                <span className="text-[var(--text-primary)]">{asset.aspect_ratio}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-4 border-t border-[var(--border)]">
            <button
              onClick={handleCopyPrompt}
              type="button"
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] py-2.5 text-xs font-mono font-medium text-[var(--text-primary)] hover:bg-[var(--surface)] hover:border-[var(--accent-border)] transition-all"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span>Prompt Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-[var(--accent)]" />
                  <span>Copy Prompt</span>
                </>
              )}
            </button>

            {onRemix && (
              <button
                onClick={handleRemixClick}
                type="button"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-light)] border border-[var(--accent-border)] py-2.5 text-xs font-mono font-medium text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all"
              >
                <Sparkles className="h-4 w-4" />
                <span>Remix in Studio</span>
              </button>
            )}

            <button
              onClick={handleDownload}
              type="button"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-2.5 text-xs font-mono font-medium text-white hover:opacity-90 shadow-md transition-all"
            >
              <Download className="h-4 w-4" />
              <span>Download High-Res</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
