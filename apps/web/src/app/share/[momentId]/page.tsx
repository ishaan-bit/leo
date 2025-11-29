'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getZone } from '@/lib/zones';
import PinkPig from '@/components/molecules/PinkPig';

interface SharedMoment {
  text: string;
  invoked: string;
  expressed: string;
  poems: string[];
  poem?: string; // Single poem from Excel
  timestamp: string;
  image_base64?: string;
  pig_name?: string;
  primaryEmotion: string;
  songs?: {
    en?: { title: string; artist: string; year: number; youtube_url: string; why: string };
    hi?: { title: string; artist: string; year: number; youtube_url: string; why: string };
  };
}

type ShareMode = 'heart' | 'poem' | 'both';

export default function ShareMomentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const momentId = params.momentId as string;
  
  // Validate and sanitize mode parameter
  const rawMode = searchParams.get('mode') || 'both';
  const mode = (['heart', 'poem', 'both'].includes(rawMode) ? rawMode : 'both') as ShareMode;
  
  // Validate and sanitize language parameter
  const rawLang = searchParams.get('lang') || 'en';
  const lang = ['en', 'hi'].includes(rawLang) ? rawLang : 'en';
  const isHindi = lang === 'hi';
  
  const [moment, setMoment] = useState<SharedMoment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
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
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-4xl"
        >
          🌸
        </motion.div>
      </div>
    );
  }

  if (error || !moment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          {/* Sad pig */}
          <motion.div
            animate={{
              y: [0, -8, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="text-7xl mb-6"
          >
            🐷
          </motion.div>
          
          {/* Error message */}
          <h1 className="text-2xl font-serif italic text-pink-900 mb-3">
            {isHindi ? 'पल खो गया शहर में' : 'This letter got lost in the city'}
          </h1>
          <p className="text-sm text-pink-600 mb-8">
            {isHindi 
              ? 'यह साझा किया गया पल हटा दिया गया हो सकता है या अब उपलब्ध नहीं है'
              : 'This shared moment may have been removed or is no longer available'}
          </p>
          
          {/* CTA */}
          <a
            href="/"
            className="inline-block px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full font-medium hover:shadow-lg transition-all"
          >
            {isHindi ? 'अपना पल बनाइए' : 'Create your own moment'}
          </a>
        </motion.div>
      </div>
    );
  }

  const zone = getZone(moment.primaryEmotion);
  const atmosphere = zone ? {
    gradient: [zone.hue, zone.color],
    textColor: zone.color,
    textMuted: zone.hue,
    accentColor: zone.color,
  } : {
    gradient: ['#fce7f3', '#fbcfe8'],
    textColor: '#831843',
    textMuted: '#9f1239',
    accentColor: '#ec4899',
  };

  const poem = moment.poem || moment.poems?.[0];

  // Envelope tap handler
  const handleReveal = () => {
    setRevealed(true);
  };

  // Get mode-specific text
  const getInstructionText = () => {
    if (isHindi) return 'पल खोलने के लिए टैप करें।';
    return 'Tap to open the moment.';
  };

  const getSubtitleText = () => {
    if (mode === 'heart') {
      return isHindi 
        ? 'किसी ने दिल का एक हिस्सा आपके साथ बाँटा है।'
        : 'Someone trusted you with a piece of their heart.';
    } else if (mode === 'poem') {
      return isHindi
        ? 'किसी ने आपके साथ एक शांत पल बाँटना चाहा।'
        : 'Someone wanted to share a quiet moment with you.';
    } else {
      return isHindi
        ? 'जो उन्होंने महसूस किया, उससे जो बना, वो सब आपके लिए।'
        : 'From what they felt to what it became.';
    }
  };

  const getCtaText = () => {
    return isHindi ? 'अपना शांत पल बनाइए →' : 'Create your own quiet moment →';
  };

  return (
    <div 
      className="min-h-screen relative"
      style={{
        background: `linear-gradient(135deg, ${atmosphere.gradient[0]}, ${atmosphere.gradient[1]})`,
      }}
    >
      <AnimatePresence mode="wait">
        {!revealed ? (
          // Envelope intro screen
          <motion.div
            key="envelope"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center p-4"
          >
            {/* Pig holding envelope */}
            <motion.div
              className="relative cursor-pointer"
              onClick={handleReveal}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={{
                y: [-8, 8, -8],
              }}
              transition={{
                y: {
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
              }}
            >
              {/* Pig */}
              <PinkPig size={200} state="idle" />
              
              {/* Glowing envelope below pig */}
              <motion.div
                className="absolute -bottom-12 left-1/2 -translate-x-1/2"
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(255, 230, 200, 0.6)',
                    '0 0 40px rgba(255, 230, 200, 0.9)',
                    '0 0 20px rgba(255, 230, 200, 0.6)',
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <div 
                  className="w-16 h-12 rounded-lg"
                  style={{
                    background: 'linear-gradient(135deg, #fff5e6, #ffe4b8)',
                    border: '2px solid rgba(255, 230, 200, 0.8)',
                  }}
                >
                  {/* Envelope flap */}
                  <div
                    className="absolute top-0 left-0 right-0 h-6 origin-top"
                    style={{
                      background: 'linear-gradient(135deg, #ffe4b8, #ffd89b)',
                      clipPath: 'polygon(0 0, 50% 60%, 100% 0)',
                      borderTop: '2px solid rgba(255, 230, 200, 0.8)',
                    }}
                  />
                </div>
              </motion.div>
            </motion.div>

            {/* Instruction text */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-20 text-center text-lg font-serif italic"
              style={{ color: atmosphere.textColor }}
            >
              {getInstructionText()}
            </motion.p>
          </motion.div>
        ) : (
          // Revealed moment content - scrollable on mobile
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="min-h-screen py-12 px-4 pb-24"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-2xl mx-auto bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl p-8 md:p-12"
            >
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-2xl font-serif italic text-pink-900 mb-2">
                  {isHindi ? 'एक शांत पल' : 'A Quiet Moment'}
                </h1>
                <p className="text-xs uppercase tracking-widest text-pink-700">
                  {new Date(moment.timestamp).toLocaleDateString(isHindi ? 'hi-IN' : 'en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>

              {/* Image if present */}
              {moment.image_base64 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="mb-8"
                >
                  <img
                    src={`data:image/jpeg;base64,${moment.image_base64}`}
                    alt="Moment"
                    className="w-full rounded-2xl shadow-lg"
                  />
                </motion.div>
              )}

              {/* Reflection (heart) - show if mode is 'heart' or 'both' */}
              {(mode === 'heart' || mode === 'both') && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="mb-8"
                >
                  <p className="text-lg font-serif leading-relaxed" style={{ color: atmosphere.textColor }}>
                    {moment.text}
                  </p>
                </motion.div>
              )}

              {/* Divider if showing both */}
              {mode === 'both' && poem && (
                <div className="my-8 flex items-center gap-4">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-pink-300 to-transparent" />
                  <span className="text-pink-400">✦</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-pink-300 to-transparent" />
                </div>
              )}

              {/* Poem - show if mode is 'poem' or 'both' */}
              {(mode === 'poem' || mode === 'both') && poem && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: mode === 'both' ? 0.6 : 0.4 }}
                  className="mb-8 text-center"
                >
                  <p className="text-base italic leading-relaxed whitespace-pre-line" style={{ color: atmosphere.textMuted }}>
                    {poem}
                  </p>
                </motion.div>
              )}

              {/* Subtitle */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="text-center mb-8"
              >
                <p className="text-sm italic" style={{ color: atmosphere.textMuted }}>
                  {getSubtitleText()}
                </p>
              </motion.div>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.0 }}
                className="text-center pt-8 border-t border-pink-200"
              >
                <a
                  href="/"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full font-medium hover:shadow-lg transition-all"
                >
                  {getCtaText()}
                </a>
                <p className="text-xs text-pink-600 mt-4">
                  ✨ 🐷 ✨
                </p>
                <p className="text-xs text-pink-500 mt-1">
                  {isHindi ? `${moment.pig_name || 'Noen'} द्वारा सुरक्षित` : `held safe by ${moment.pig_name || 'Noen'}`}
                </p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
