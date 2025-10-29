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

export default function ShareMomentPage() {
  const params = useParams();
  const momentId = params.momentId as string;
  const [moment, setMoment] = useState<SharedMoment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
        <div className="text-center">
          <p className="text-xl text-pink-800 mb-4">✨ Moment not found</p>
          <p className="text-sm text-pink-600">This shared moment may have been removed</p>
        </div>
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

  const song = moment.songs?.en || moment.songs?.hi;

  return (
    <div 
      className="min-h-screen py-12 px-4"
      style={{
        background: `linear-gradient(135deg, ${atmosphere.gradient[0]}, ${atmosphere.gradient[1]})`,
      }}
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
            A Moment Held Safe
          </h1>
          <p className="text-xs uppercase tracking-widest text-pink-700">
            {new Date(moment.timestamp).toLocaleDateString('en-US', {
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

        {/* Reflection text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mb-8"
        >
          <p className="text-xs italic text-pink-700 mb-3">You wrote:</p>
          <p className="text-lg font-serif leading-relaxed" style={{ color: atmosphere.textColor }}>
            {moment.text}
          </p>
        </motion.div>

        {/* Emotions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mb-8 pl-6 border-l-2"
          style={{ borderColor: `${atmosphere.accentColor}40` }}
        >
          <p className="text-xs uppercase tracking-wider text-pink-700 mb-2">feeling:</p>
          <p className="text-sm" style={{ color: atmosphere.textColor }}>
            {moment.invoked} → {moment.expressed}
          </p>
        </motion.div>

        {/* Poem */}
        {moment.poems?.[0] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mb-8 text-center"
          >
            <p className="text-sm italic leading-relaxed" style={{ color: atmosphere.textMuted }}>
              {moment.poems[0]}
            </p>
          </motion.div>
        )}

        {/* Song */}
        {song && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className="mb-8"
          >
            <p className="text-xs italic text-pink-700 mb-3">🎵 a song for this moment:</p>
            <div className="bg-pink-50/50 rounded-xl p-4">
              <p className="font-semibold text-pink-900 mb-1">{song.title}</p>
              {song.artist && <p className="text-sm text-pink-700 mb-2">by {song.artist}</p>}
              {song.youtube_url && (
                <a
                  href={song.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Listen on YouTube →
                </a>
              )}
            </div>
          </motion.div>
        )}

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="text-center text-xs text-pink-600 mt-8"
        >
          <p>held safe by {moment.pig_name || 'Noen'} 🐷</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
