import type { Metadata, Viewport } from 'next';
import './globals.css';
import './extras.css';

export const metadata: Metadata = {
  title: 'MultiGauge OBD Universal',
  description: 'A simple bilingual OBD-II vehicle monitor and diagnostic tool.',
  manifest: '/manifest.webmanifest',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'MultiGauge OBD Universal',
    description: 'Smart car monitor • Basic diagnostics',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'MultiGauge OBD Universal dashboard' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MultiGauge OBD Universal',
    description: 'Smart car monitor • Basic diagnostics',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#08111f' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
