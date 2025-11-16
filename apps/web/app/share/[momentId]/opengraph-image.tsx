import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'A quiet moment for you';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { momentId: string } }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #fce7f3, #fbcfe8)',
          fontFamily: 'system-ui',
        }}
      >
        {/* Pig emoji placeholder */}
        <div style={{ fontSize: 200, marginBottom: 40 }}>🐷</div>
        
        {/* Title */}
        <div
          style={{
            fontSize: 60,
            fontWeight: 600,
            color: '#831843',
            marginBottom: 20,
            fontStyle: 'italic',
          }}
        >
          A quiet moment for you
        </div>
        
        {/* Subtitle */}
        <div
          style={{
            fontSize: 30,
            color: '#9f1239',
            opacity: 0.8,
          }}
        >
          Tap to open ✨
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
