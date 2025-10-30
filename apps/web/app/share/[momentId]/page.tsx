'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { getZone } from '@/lib/zones';

interface SharedMoment {
  text: string;
  invoked: string;
  expressed: string;
  poems: string[];
  timestamp: string;
  image_base64?: string;
  pig_name?: string;
  primaryEmotion: string;
  songs?: {
    en?: { title: string; artist: string; year: number; youtube_url: string; why: string };
    hi?: { title: string; artist: string; year: number; youtube_url: string; why: string };
  };
}

// Atmosphere definitions (matching MomentsLibrary.tsx exactly)
const getAtmosphere = (zoneId: string | null) => {
  const atmospheres: Record<string, any> = {
    peaceful: {
      gradient: ['#E8F4F8', '#D4E8F0', '#B8D8E8'],
      accentColor: '#4A9FC9',
      accentGlow: '#5AAFE0',
      textColor: '#2C3E50',
      textMuted: '#607D8B',
    },
    powerful: {
      gradient: ['#FFE5E5', '#FFD0D0', '#FFB8B8'],
      accentColor: '#E74C3C',
      accentGlow: '#FF6B5A',
      textColor: '#2C3E50',
      textMuted: '#795548',
    },
    joyful: {
      gradient: ['#FFF9E5', '#FFEED0', '#FFE0A8'],
      accentColor: '#F39C12',
      accentGlow: '#FFC233',
      textColor: '#2C3E50',
      textMuted: '#8D6E63',
    },
    mad: {
      gradient: ['#FFE8E0', '#FFD4C8', '#FFC0B0'],
      accentColor: '#D84315',
      accentGlow: '#FF5722',
      textColor: '#2C3E50',
      textMuted: '#795548',
    },
    scared: {
      gradient: ['#F3E8FF', '#E8D4FF', '#D8C0FF'],
      accentColor: '#8E44AD',
      accentGlow: '#A862D8',
      textColor: '#2C3E50',
      textMuted: '#6A5B7B',
    },
    sad: {
      gradient: ['#E8F0F8', '#D4E0ED', '#C0D0E0'],
      accentColor: '#5A7FA0',
      accentGlow: '#7099BB',
      textColor: '#2C3E50',
      textMuted: '#607D8B',
    },
  };
  
  return atmospheres[zoneId || 'peaceful'] || atmospheres.peaceful;
};

export default function ShareMomentPage() {
  const params = useParams();
  const momentId = params.momentId as string;
  const [moment, setMoment] = useState<SharedMoment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Set page title
    document.title = 'Your Moment Held Safe';
    
    async function fetchSharedMoment() {
      try {
        const response = await fetch(`/api/share/${momentId}`);
        if (!response.ok) {
          throw new Error('Moment not found');
        }
        const data = await response.json();
        setMoment(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load moment');
      } finally {
        setLoading(false);
      }
    }

    fetchSharedMoment();
  }, [momentId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            duration: 0.8,
            ease: [0.4, 0, 0.2, 1],
            scale: {
              type: "spring",
              damping: 15,
              stiffness: 100
            }
          }}
          className="text-center"
        >
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="text-6xl mb-4"
          >
            🌸
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-pink-800/60 text-sm"
          >
            Opening your moment...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  if (error || !moment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
        <div className="text-center">
          <p className="text-xl text-pink-800 mb-4">✨ Moment not found</p>
          <p className="text-sm text-pink-600">This shared moment may have been removed</p>
        </div>
      </div>
    );
  }

  const zone = getZone(moment.primaryEmotion);
  const atmosphere = getAtmosphere(zone?.id || null);
  const song = moment.songs?.en || moment.songs?.hi;
  
  // Extract YouTube video ID and convert to embed URL
  const getYouTubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    const videoId = url.includes('watch?v=') 
      ? url.split('watch?v=')[1]?.split('&')[0]
      : url.split('/').pop();
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1&enablejsapi=1` : null;
  };

  const embedUrl = getYouTubeEmbedUrl(song?.youtube_url);

  return (
    <div 
      className="min-h-screen w-full overflow-y-auto py-8 sm:py-12 px-4"
      style={{
        background: `radial-gradient(circle at center, ${atmosphere.gradient[0]} 0%, ${atmosphere.gradient[1]} 50%, ${atmosphere.gradient[2]} 100%)`,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className="relative max-w-2xl w-full mx-auto mb-8"
        style={{
          backdropFilter: 'blur(12px) saturate(120%) brightness(1.05)',
          borderRadius: '32px',
          border: `1px solid rgba(255, 255, 255, 0.25)`,
          boxShadow: `
            0 0 0 1px ${atmosphere.gradient[0]}40,
            0 24px 72px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255,255,255,0.5)
          `,
        }}
      >
        {/* Inner wrapper with background layers */}
        <div className="relative min-h-full">
          {/* Background gradient layer */}
          <div 
            className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none rounded-[32px] z-0"
            style={{
              background: `linear-gradient(135deg, ${atmosphere.gradient[0]} 0%, ${atmosphere.gradient[1]} 50%, ${atmosphere.gradient[2]} 100%)`,
            }}
          />

          {/* Foreground contrast overlay */}
          <div 
            className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none rounded-[32px] z-0"
            style={{
              background: 'linear-gradient(180deg, rgba(0,0,0,0.08), rgba(255,255,255,0.05) 40%, rgba(0,0,0,0.12))',
              mixBlendMode: 'soft-light',
            }}
          />

          {/* Subtle vignette mask */}
          <div 
            className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none rounded-[32px] z-0"
            style={{
              background: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,0.15), rgba(0,0,0,0.3) 90%)',
            }}
          />

          {/* Radial lighting layer */}
          <div 
            className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none rounded-[32px] z-0"
            style={{
              background: `radial-gradient(circle at 15% 20%, ${atmosphere.accentGlow} 0%, transparent 60%)`,
              opacity: 0.6,
            }}
          />

          {/* Content wrapper */}
          <div className="relative z-10 p-8 md:p-12">
            {/* Header */}
            <motion.div
              className="mb-12 text-center"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <h1 
                className="text-3xl md:text-4xl mb-4"
                style={{
                  fontFamily: '"Cormorant Garamond", "EB Garamond", "Georgia", serif',
                  color: atmosphere.textColor,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                A Moment Held Safe
              </h1>
              <p 
                className="text-sm"
                style={{
                  fontFamily: '"Inter", -apple-system, sans-serif',
                  color: atmosphere.textMuted,
                  letterSpacing: '0.08em',
                  opacity: 0.8,
                }}
              >
                {new Date(moment.timestamp).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
            </motion.div>

            {/* Image */}
            {moment.image_base64 && (
              <motion.div
                className="mb-12"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                <img
                  src={moment.image_base64.startsWith('data:') ? moment.image_base64 : `data:image/jpeg;base64,${moment.image_base64}`}
                  alt="Moment"
                  className="w-full max-h-[600px] object-contain rounded-2xl"
                  style={{
                    boxShadow: `0 12px 32px ${atmosphere.gradient[0]}60`,
                  }}
                />
              </motion.div>
            )}

            {/* Main reflection text */}
            <motion.div
              className="mb-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <p
                className="text-[16px] md:text-[18px]"
                style={{
                  fontFamily: '"Cormorant Garamond", "EB Garamond", "Georgia", serif',
                  color: atmosphere.textColor,
                  fontWeight: 400,
                  letterSpacing: '0.02em',
                  lineHeight: '1.8',
                  textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                }}
              >
                {moment.text}
              </p>
            </motion.div>

            {/* Emotional Anatomy */}
            <motion.div
              className="mb-12 space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              {moment.invoked && (
                <div
                  className="pl-6 border-l-2"
                  style={{ borderColor: `${atmosphere.accentColor}40` }}
                >
                  <div 
                    className="text-[0.7rem] uppercase tracking-widest mb-3"
                    style={{
                      fontFamily: '"Playfair Display", "Lora", "Georgia", serif',
                      fontStyle: 'italic',
                      color: atmosphere.textMuted,
                      letterSpacing: '0.12em',
                      opacity: 0.7,
                      textShadow: '0 1px 1px rgba(0,0,0,0.15)',
                    }}
                  >
                    What stirred the air
                  </div>
                  <div
                    className="text-[15px]"
                    style={{
                      fontFamily: '"Inter", -apple-system, sans-serif',
                      color: atmosphere.textColor,
                      lineHeight: '1.8',
                      fontWeight: 400,
                      letterSpacing: '0.02em',
                      textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    }}
                  >
                    {moment.invoked}
                  </div>
                </div>
              )}
              
              {moment.expressed && (
                <div
                  className="pl-6 border-l-2"
                  style={{ borderColor: `${atmosphere.accentColor}40` }}
                >
                  <div 
                    className="text-[0.7rem] uppercase tracking-widest mb-3"
                    style={{
                      fontFamily: '"Playfair Display", "Lora", "Georgia", serif',
                      fontStyle: 'italic',
                      color: atmosphere.textMuted,
                      letterSpacing: '0.12em',
                      opacity: 0.7,
                      textShadow: '0 1px 1px rgba(0,0,0,0.15)',
                    }}
                  >
                    How it lingered in you
                  </div>
                  <div
                    className="text-[15px]"
                    style={{
                      fontFamily: '"Inter", -apple-system, sans-serif',
                      color: atmosphere.textColor,
                      lineHeight: '1.8',
                      fontWeight: 400,
                      letterSpacing: '0.02em',
                      textShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    }}
                  >
                    {moment.expressed}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Poems */}
            {moment.poems && moment.poems.length > 0 && (
              <motion.div
                className="mb-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                <div 
                  className="text-[0.7rem] uppercase tracking-widest mb-6 text-center"
                  style={{
                    fontFamily: '"Playfair Display", "Lora", "Georgia", serif',
                    fontStyle: 'italic',
                    color: atmosphere.textMuted,
                    letterSpacing: '0.12em',
                    opacity: 0.7,
                  }}
                >
                  What the wind remembered
                </div>
                {moment.poems.map((poem, index) => (
                  <p
                    key={index}
                    className="text-center text-[15px] md:text-[16px] mb-6 italic"
                    style={{
                      fontFamily: '"Lora", "Crimson Text", "Georgia", serif',
                      color: atmosphere.textColor,
                      lineHeight: '1.9',
                      letterSpacing: '0.01em',
                      opacity: 0.9,
                    }}
                  >
                    {poem}
                  </p>
                ))}
              </motion.div>
            )}

            {/* YouTube Embedded Player */}
            {embedUrl && (
              <motion.div
                className="mb-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.7 }}
              >
                <div 
                  className="text-[0.7rem] uppercase tracking-widest mb-6 text-center"
                  style={{
                    fontFamily: '"Playfair Display", "Lora", "Georgia", serif',
                    fontStyle: 'italic',
                    color: atmosphere.textMuted,
                    letterSpacing: '0.12em',
                    opacity: 0.7,
                  }}
                >
                  A song for this moment
                </div>
                
                {song?.why && (
                  <div
                    className="px-6 pt-4 pb-6 text-xs italic text-center"
                    style={{
                      fontFamily: '"Inter", -apple-system, sans-serif',
                      color: atmosphere.textMuted,
                      opacity: 0.6,
                      lineHeight: '1.6',
                    }}
                  >
                    {song.why}
                  </div>
                )}

                <div className="relative" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={embedUrl}
                    className="absolute top-0 left-0 w-full h-full rounded-xl"
                    style={{
                      border: 'none',
                      filter: 'saturate(1.1) brightness(1.05)',
                    }}
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    title={song?.title ? `${song.title} by ${song.artist}` : 'Song recommendation'}
                  />
                </div>

                {/* Song metadata */}
                {(song?.title || song?.artist) && (
                  <div 
                    className="text-center p-4 mt-4 rounded-xl backdrop-blur-sm"
                    style={{
                      background: `linear-gradient(135deg, ${atmosphere.accentColor}05, transparent)`,
                    }}
                  >
                    {song.title && (
                      <div
                        className="text-lg font-medium"
                        style={{
                          fontFamily: '"Cormorant Garamond", "EB Garamond", "Georgia", serif',
                          color: atmosphere.textColor,
                          letterSpacing: '0.02em',
                        }}
                      >
                        {song.title}
                      </div>
                    )}
                    {song.artist && (
                      <div
                        className="text-sm mt-1"
                        style={{
                          fontFamily: '"Inter", -apple-system, sans-serif',
                          color: atmosphere.textMuted,
                          opacity: 0.8,
                        }}
                      >
                        {song.artist}
                        {song.year && ` • ${song.year}`}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Footer */}
            <motion.div
              className="pt-8 border-t border-white/20 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              <p 
                className="text-sm"
                style={{
                  fontFamily: '"Inter", -apple-system, sans-serif',
                  color: atmosphere.textMuted,
                  opacity: 0.7,
                }}
              >
                held safe by {moment.pig_name} 🐷
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
