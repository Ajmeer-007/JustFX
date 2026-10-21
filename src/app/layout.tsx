import type { Metadata } from 'next';
import '@/styles/globals.css';
import { ThemeProvider } from '@/lib/theme/ThemeContext';

export const metadata: Metadata = {
  title: 'JustFX · ICT/SMC Trading Analysis Dashboard',
  description:
    'Real-time ICT and Smart Money Concepts intraday scalping analysis dashboard for Gold, Silver, Forex, and Bitcoin with deterministic signals, backtesting, paper trading, and news warnings.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        {/* Prevent flash of wrong theme: set theme attr before React hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('justfx_theme') || 'dark';
                document.documentElement.setAttribute('data-theme', t);
              } catch(e) {}
            `
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
