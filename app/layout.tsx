import 'leaflet/dist/leaflet.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import PwaBootstrap from '@/app/components/PwaBootstrap';

export const metadata: Metadata = {
  title: 'מערכת איתור תשתיות',
  description: 'ניהול פרויקטים לעובדי שטח, סטטוסים, תמונות והיסטוריית שינויים',
  applicationName: 'MAYA',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MAYA',
  },
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b2348'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="he" dir="rtl"><body><PwaBootstrap />{children}</body></html>;
}
