import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://verify.togttrading.com'),
  title: {
    default: 'Yene Verify — Verify Ethiopian bank payments in seconds',
    template: '%s | Yene Verify',
  },
  description:
    'Verify CBE, Telebirr, Awash, Dashen, Abyssinia, M-Pesa, and Zemen payment receipts instantly. Detect duplicates and fake receipts for Ethiopian businesses.',
  openGraph: {
    title: 'Yene Verify',
    description: 'Verify any Ethiopian bank payment. In seconds.',
    url: 'https://verify.togttrading.com',
    siteName: 'Yene Verify',
    locale: 'en_ET',
    type: 'website',
    images: [{ url: '/app-icon-1024.png', width: 1024, height: 1024, alt: 'Yene Verify' }],
  },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/app-icon-1024.png',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@500;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
