import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import type { Viewport } from 'next';
import './globals.css';
import PwaRegistration from './pwa';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Ритм — дневник питания',
  description: 'Простой дневник питания, активности и ежедневного ритма.',
  applicationName: 'Ритм',
  icons: { icon: '/og.png', apple: '/og.png' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Ритм' },
  openGraph: {
    title: 'Ритм — дневник питания',
    description: 'Питание, активность и стрик — без лишнего.',
    type: 'website',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ритм — дневник питания',
    description: 'Питание, активность и стрик — без лишнего.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#24352b',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
