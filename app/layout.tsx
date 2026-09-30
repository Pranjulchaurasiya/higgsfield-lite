import type { Metadata } from 'next';
import { Newsreader, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const newsreader = Newsreader({
  variable: '--font-serif-display',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-sans-body',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono-code',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Atelier · Generative Studio & Model Context Protocol Engine',
  description:
    'A high-fidelity generative creation studio powered by Cloudflare Workers AI FLUX.1-schnell, verifiable credit ledgers with instant failure refunds, and native Model Context Protocol (MCP) server integration.',
  keywords: [
    'AI Image Generation',
    'FLUX Schnell',
    'Cloudflare Workers AI',
    'Model Context Protocol',
    'MCP Server',
    'Next.js 16',
    'Supabase',
    'Generative Studio',
  ],
  authors: [{ name: 'Pranjul Chaurasiya' }],
  openGraph: {
    title: 'Atelier · Generative Studio & MCP Engine',
    description:
      'High-fidelity FLUX.1-schnell image generation studio with verifiable transactional credit ledger, auto-refunds, and native Model Context Protocol (MCP) server for Claude & Cursor.',
    type: 'website',
    siteName: 'Atelier Studio',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Atelier · Generative Studio & MCP Engine',
    description:
      'Live Cloudflare FLUX Schnell generative studio with transactional demo credits and native MCP agent API.',
  },
};

const jsonLdData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://atelier-studio.vercel.app/#application',
      name: 'Atelier Studio',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'All',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      description:
        'An editorial AI image generation platform built with Next.js Turbopack, Cloudflare Workers AI FLUX Schnell, Supabase, and native Model Context Protocol (MCP) server integration.',
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://atelier-studio.vercel.app/#faq',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What model powers image generation in Atelier?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Atelier connects to Cloudflare Workers AI running Black Forest Labs FLUX.1-schnell via asynchronous server-side inference.',
          },
        },
        {
          '@type': 'Question',
          name: 'How does the credit ledger and failure refund mechanism work?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Each generation reserves 1 demo credit. If an execution times out or encounters a provider error, an idempotent transactional refund of +1 credit is immediately posted to the user ledger.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can AI agents connect to Atelier via Model Context Protocol (MCP)?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Atelier includes a native Model Context Protocol (MCP) JSON-RPC 2.0 server at /api/mcp and /mcp compatible with Claude Desktop, Cursor, and Windsurf.',
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${jakarta.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-[var(--canvas)] text-[var(--text-primary)] selection:bg-[var(--accent-light)] selection:text-[var(--accent)]">
        {children}
      </body>
    </html>
  );
}
