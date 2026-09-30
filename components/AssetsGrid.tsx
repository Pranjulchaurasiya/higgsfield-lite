'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Download, Trash2, Sparkles, Layers } from 'lucide-react';

export interface AssetItem {
  id: string;
  job_id: string | null;
  storage_object_key: string;
  prompt: string;
  aspect_ratio: string;
  width: number;
  height: number;
  is_sample: boolean;
  created_at: string;
  url?: string;
}

interface AssetsGridProps {
  assets: AssetItem[];
  onRemix: (prompt: string, aspectRatio: string) => void;
  onDeleteAsset: (id: string) => void;
  isLoading?: boolean;
}

export function AssetsGrid({ assets, onRemix, onDeleteAsset, isLoading }: AssetsGridProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this creation from your library?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/assets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onDeleteAsset(id);
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full py-16 text-center space-y-3">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
        <p className="text-xs font-mono text-[var(--text-muted)]">Loading archive...</p>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="w-full rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/50 py-16 px-6 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)]">
          <Layers className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h3 className="font-serif text-lg font-normal text-[var(--text-primary)]">
            Empty Library
          </h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
            No creations generated yet. Enter a prompt in the Studio above to produce your first image.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-xl font-normal text-[var(--text-primary)]">
            Creation Archive
          </h2>
          <span className="rounded-full bg-[var(--surface-muted)] border border-[var(--border)] px-2 py-0.5 font-mono text-xs text-[var(--text-secondary)]">
            {assets.length}
          </span>
        </div>
        <span className="font-mono text-xs text-[var(--text-muted)]">Contact Sheet Grid</span>
      </div>

      {/* Responsive Contact Sheet Grid with items-start to keep natural card height */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
        {assets.map((asset, index) => {
          const aspectClass =
            asset.aspect_ratio === '9:16'
              ? 'aspect-[9/16]'
              : asset.aspect_ratio === '16:9'
              ? 'aspect-[16/9]'
              : 'aspect-square';

          const imageUrl = asset.url || `/api/assets/${asset.id}/download`;

          return (
            <div
              key={`${asset.id}-${index}`}
              className="group flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-xs hover:border-[var(--accent-border)] transition-all hover:shadow-md"
            >
              {/* Media Frame */}
              <div className={`relative w-full ${aspectClass} bg-[var(--surface-muted)] overflow-hidden`}>
                <Image
                  src={imageUrl}
                  alt={asset.is_sample ? 'Sample image, not generated' : asset.prompt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-103"
                  priority={index === 0}
                  unoptimized
                />

                {/* Badges Overlay */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                  <span className="rounded bg-black/60 backdrop-blur-xs px-2 py-0.5 font-mono text-[10px] font-medium text-white uppercase tracking-wider">
                    {asset.aspect_ratio}
                  </span>
                  {asset.is_sample && (
                    <span className="rounded bg-[var(--badge-sample-bg)] border border-amber-300 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--badge-sample)] uppercase tracking-wider">
                      SAMPLE
                    </span>
                  )}
                </div>
              </div>

              {/* Caption Strip */}
              <div className="p-3.5 flex flex-col justify-between border-t border-[var(--border)] bg-[var(--surface)] text-xs space-y-3">
                <div className="space-y-1.5">
                  <p
                    className="line-clamp-2 text-[var(--text-primary)] font-normal leading-relaxed"
                    title={asset.is_sample ? 'Sample image, not generated' : asset.prompt}
                  >
                    {asset.is_sample ? (
                      <span className="italic text-[var(--text-secondary)]">Sample image, not generated</span>
                    ) : (
                      <>&ldquo;{asset.prompt}&rdquo;</>
                    )}
                  </p>
                  <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
                    <span>{new Date(asset.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    <span>{asset.width}×{asset.height}px</span>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                  {/* Remix (Restore settings) - only for user-generated creations */}
                  {!asset.is_sample ? (
                    <button
                      type="button"
                      onClick={() => onRemix(asset.prompt, asset.aspect_ratio)}
                      className="inline-flex items-center gap-1.5 min-h-[38px] rounded-md px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      title="Remix: restore prompt and aspect ratio to Studio"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Remix</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-1">
                    {/* Download */}
                    <a
                      href={`/api/assets/${asset.id}/download`}
                      download
                      className="inline-flex items-center justify-center min-w-[38px] min-h-[38px] rounded-md p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      title="Download image"
                      aria-label="Download image"
                    >
                      <Download className="h-4 w-4" />
                    </a>

                    {/* Delete */}
                    <button
                      type="button"
                      disabled={deletingId === asset.id}
                      onClick={() => handleDelete(asset.id)}
                      className="inline-flex items-center justify-center min-w-[38px] min-h-[38px] rounded-md p-2 text-[var(--text-secondary)] hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      title="Delete asset"
                      aria-label="Delete asset"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
