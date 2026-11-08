import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://mekatanker.shop'),
  title: {
    default: 'Yene Verify — Verify Ethiopian bank payments in seconds',
    template: '%s | Yene Verify',
  },
  description:
    'Verify CBE, Telebirr, Awash, Dashen, Abyssinia, M-Pesa, and Zemen payment receipts instantly. Detect duplicates and fake receipts for Ethiopian businesses.',
  openGraph: {
    title: 'Yene Verify',
    description: 'Verify any Ethiopian bank payment. In seconds.',
    url: 'https://mekatanker.shop',
    siteName: 'Yene Verify',
    locale: 'en_ET',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
