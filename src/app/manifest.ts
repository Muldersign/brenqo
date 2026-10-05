import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Brenqo — facturen, bonnetjes & bank',
    short_name: 'Brenqo',
    description: 'Facturen maken, betalingen ontvangen en bonnetjes scannen. Zonder boekhoudkennis.',
    lang: 'nl-NL',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f6f8',
    theme_color: '#f6f6f8',
    categories: ['finance', 'business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Bon scannen', short_name: 'Bon', url: '/?scan=1', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Nieuwe factuur', short_name: 'Factuur', url: '/facturen/nieuw', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
