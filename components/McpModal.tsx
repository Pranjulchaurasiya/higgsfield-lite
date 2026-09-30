'use client';

import { useState } from 'react';
import { X, Copy, Check, Terminal, Cpu, Sparkles, BookOpen } from 'lucide-react';

interface McpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function McpModal({ isOpen, onClose }: McpModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://atelier-studio.vercel.app';
  const mcpUrl = `${currentOrigin}/api/mcp`;

  const cursorJson = JSON.stringify(
    {
      mcpServers: {
        atelier: {
          url: mcpUrl,
        },
      },
    },
    null,
    2
  );

  const claudeDesktopJson = JSON.stringify(
    {
      mcpServers: {
        atelier: {
          command: 'npx',
          args: ['-y', 'mcp-remote', mcpUrl],
        },
      },
    },
    null,
    2
  );

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent-border)]">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 id="mcp-title" className="text-lg font-serif font-medium text-[var(--text-primary)]">
                Model Context Protocol (MCP) Server
              </h2>
              <p className="text-xs text-[var(--text-secondary)] font-mono">
                Connect Claude Desktop, Cursor, or autonomous coding agents to Atelier
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Overview Box */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/50 p-4 space-y-2 text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span>Agent-Native Generative Capabilities</span>
          </div>
          <p>
            Atelier exposes standard JSON-RPC 2.0 tools for AI agents to trigger FLUX Schnell image generation, monitor job lifecycle, check demo wallet balances, and browse the asset library programmatically.
          </p>
          <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
            <span className="rounded bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-[var(--accent)]">
              atelier_generate_image
            </span>
            <span className="rounded bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-[var(--accent)]">
              atelier_get_credits
            </span>
            <span className="rounded bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-[var(--accent)]">
              atelier_list_assets
            </span>
            <span className="rounded bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-[var(--accent)]">
              atelier_get_job_status
            </span>
          </div>
        </div>

        {/* Config 1: Cursor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5 font-mono">
              <Terminal className="h-3.5 w-3.5 text-[var(--accent)]" />
              Cursor (.cursor/mcp.json)
            </span>
            <button
              onClick={() => handleCopy(cursorJson, 'cursor')}
              className="flex items-center gap-1 text-[var(--accent)] hover:underline font-mono text-[11px]"
            >
              {copiedKey === 'cursor' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Configuration</span>
                </>
              )}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--canvas)] p-3 font-mono text-xs text-[var(--text-primary)]">
            {cursorJson}
          </pre>
        </div>

        {/* Config 2: Claude Desktop */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5 font-mono">
              <BookOpen className="h-3.5 w-3.5 text-[var(--accent)]" />
              Claude Desktop (claude_desktop_config.json)
            </span>
            <button
              onClick={() => handleCopy(claudeDesktopJson, 'claude')}
              className="flex items-center gap-1 text-[var(--accent)] hover:underline font-mono text-[11px]"
            >
              {copiedKey === 'claude' ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Configuration</span>
                </>
              )}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--canvas)] p-3 font-mono text-xs text-[var(--text-primary)]">
            {claudeDesktopJson}
          </pre>
        </div>

        {/* Endpoint Info */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-xs text-[var(--text-muted)] font-mono">
          <span>Live Endpoint: <code className="text-[var(--text-primary)]">{mcpUrl}</code></span>
          <button
            onClick={onClose}
            className="rounded-lg bg-[var(--accent)] px-4 py-1.5 font-sans font-medium text-white hover:opacity-95 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
