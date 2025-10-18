import '../src/styles/globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Name Me',
  description: 'A gentle naming ritual for your flying pig.',
  openGraph: {
    title: 'Name Me',
    description: 'A gentle naming ritual for your flying pig.',
  },
  // Helps mobile browser UI pick a gentle chrome color
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffe4e6' }, // rose-100
    { media: '(prefers-color-scheme: dark)', color: '#0f0a0a' },
  ],
  formatDetection: {
    telephone: false, // avoid auto-linking random numbers
    address: false,
    email: false,
  },
  // Optional: if you later add manifest for PWA
  // manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,       // keep zoom accessible
  userScalable: true,    // never lock zoom — accessibility
  viewportFit: 'cover',  // use full screen on phones with notches
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" style={{ margin: 0, padding: 0 }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Text:ital@0;1&family=Inter:wght@400;500;600;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body
        className="
          h-full antialiased text-pink-900
          [text-size-adjust:100%] [webkit-text-size-adjust:100%]
          selection:bg-rose-200 selection:text-pink-900
        "
        style={{
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          margin: 0,
          padding: 0,
          overflow: 'hidden'
        }}
      >
        {children}
      </body>
    </html>
  );
}
