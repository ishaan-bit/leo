'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface ReflectPageProps {
  params: { pigId: string };
}

export default function ReflectPage({ params }: ReflectPageProps) {
  const [pigName, setPigName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPigName() {
      try {
        const res = await fetch(`/api/pig/${params.pigId}`);
        if (res.ok) {
          const data = await res.json();
          setPigName(data.name || 'Unknown');
        }
      } catch (err) {
        console.error('Failed to fetch pig name:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPigName();
  }, [params.pigId]);

  if (isLoading) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-pink-100 via-peach-100 to-purple-100">
        <p className="text-pink-700/60 animate-pulse">Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-pink-100 via-peach-100 to-purple-100 px-6">
      <motion.div
        className="text-center max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <motion.h1
          className="text-5xl font-display text-pink-900 mb-6"
          style={{ fontFamily: "'DM Serif Text', Georgia, serif" }}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Welcome, {pigName}
        </motion.h1>
        
        <motion.p
          className="text-xl text-pink-700/80 leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          This is your reflection space.
          <br />
          <span className="text-pink-600/60 text-sm mt-4 block">
            More magic coming soon... ✨
          </span>
        </motion.p>
      </motion.div>
    </main>
  );
}
