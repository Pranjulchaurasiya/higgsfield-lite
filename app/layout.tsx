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
  title: 'Atelier · Editorial Image Generation',
  description: 'A focused, transparent generative studio powered by Cloudflare Workers AI FLUX Schnell with verifiable demo credit ledger.',
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
      <body className="min-h-full flex flex-col font-sans bg-[var(--canvas)] text-[var(--text-primary)] selection:bg-[var(--accent-light)] selection:text-[var(--accent)]">
        {children}
      </body>
    </html>
  );
}
