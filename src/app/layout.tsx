import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/geist';
import './globals.css';
import { Toaster } from 'sonner';
import { ServiceWorker } from '@/components/pwa/service-worker';

export const metadata: Metadata = {
  title: { default: 'Brenqo', template: '%s · Brenqo' },
  description: 'Facturen, bonnetjes, bank en btw — zonder boekhoudkennis.',
  applicationName: 'Brenqo',
  appleWebApp: { capable: true, title: 'Brenqo', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/icons/favicon.svg', type: 'image/svg+xml' }, { url: '/icons/icon-192.png', sizes: '192x192' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#f5f5f5',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        {children}
        <Toaster
          position="bottom-right"
          offset={20}
          mobileOffset={{ bottom: 'calc(88px + env(safe-area-inset-bottom))' }}
          toastOptions={{
            classNames: {
              toast: '!rounded-2xl !border-line !shadow-pop !font-sans !text-[13.5px] !text-ink',
              description: '!text-muted',
            },
          }}
        />
        <ServiceWorker />
      </body>
    </html>
  );
}
