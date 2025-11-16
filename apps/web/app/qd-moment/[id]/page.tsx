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
  poem?: string;
  timestamp: string;
  image_base64?: string;
  pig_name?: string;
  primaryEmotion: string;
}

type ShareMode = 'heart' | 'poem' | 'both';

export default function QDMomentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const momentId = params.id as string;
  
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
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
      <div className="min-h-screen relative overflow-hidden">
        {/* Ghibli-style sky gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a3e] via-[#2d1b4e] to-[#4a1f5c]" />
        
        {/* Twinkling stars */}
        <div className="absolute inset-0">
          {[...Array(30)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 60}%`,
              }}
              animate={{
                opacity: [0.2, 1, 0.2],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 2 + Math.random() * 3,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4 pt-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md flex flex-col items-center"
          >
            {/* Pig floating like in city interlude - positioned higher */}
            <motion.div
              animate={{
                y: [0, -12, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="mb-12"
            >
              <PinkPig size={160} state="idle" />
            </motion.div>
            
            {/* Error message */}
            <h1 className="text-2xl font-serif italic text-pink-100 mb-3">
              {isHindi ? 'पल खो गया शहर में' : 'This letter got lost in the city'}
            </h1>
            <p className="text-sm text-pink-300 mb-8 leading-relaxed">
              {isHindi 
                ? 'यह साझा किया गया पल हटा दिया गया हो सकता है या अब उपलब्ध नहीं है'
                : 'This shared moment may have been removed or is no longer available'}
            </p>
            
            {/* CTA */}
            <a
              href="/start"
              className="inline-block px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full font-medium hover:shadow-lg transition-all"
            >
              {isHindi ? 'अपना QuietDen पल बनाइए' : 'Create your QuietDen moment'}
            </a>
          </motion.div>
        </div>
      </div>
    );
  }

  const zone = getZone(moment.primaryEmotion);
  
  const poem = moment.poem || moment.poems?.[0];

  // Envelope tap handler
  const handleReveal = () => {
    setRevealed(true);
  };

  // Get mode-specific text
  const getInstructionText = () => {
    if (isHindi) return 'इस QD Moment को खोलने के लिए टैप करें।';
    return 'Tap to open this QD Moment.';
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
        ? 'जो उन्होंने महसूस किया, उससे जो बना — वो सब आपके लिए है।'
        : 'From what they felt to what it became.';
    }
  };

  const getCtaText = () => {
    return isHindi ? 'अपना शांत पल बनाइए →' : 'Create your own quiet moment →';
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <AnimatePresence mode="wait">
        {!revealed ? (
          // Initial screen with floating pig
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center p-4"
            onClick={handleReveal}
          >
            {/* Floating pig */}
            <motion.div
              className="cursor-pointer"
              animate={{
                y: [-10, 10, -10],
              }}
              transition={{
                y: {
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <PinkPig size={200} state="idle" />
            </motion.div>

            {/* Instruction text */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-12 text-center text-lg font-serif italic text-pink-100 px-4"
            >
              {getInstructionText()}
            </motion.p>
          </motion.div>
        ) : (
          // Revealed moment content
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="min-h-screen py-12 px-4 flex items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-2xl w-full bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 md:p-12"
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
                  <p className="text-lg font-serif leading-relaxed text-pink-900">
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
                  <p className="text-base italic leading-relaxed whitespace-pre-line text-pink-800">
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
                <p className="text-sm italic text-pink-700">
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
                  href="/start"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full font-medium hover:shadow-lg transition-all"
                >
                  {isHindi ? 'अपना QuietDen पल बनाइए →' : 'Create your QuietDen moment →'}
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
