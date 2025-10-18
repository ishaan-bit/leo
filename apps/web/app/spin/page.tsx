'use client';

import { useSearchParams } from 'next/navigation';
import { useSceneState } from '@/providers/SceneStateProvider';
import { motion } from 'framer-motion';
import { Suspense } from 'react';

function SpinContent() {
  const searchParams = useSearchParams();
  const seed = searchParams.get('seed');
  const { affect } = useSceneState();

  return (
    <section className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 px-6">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
      >
        <h1 className="text-4xl font-serif text-pink-900 mb-6">
          The Spin Scene
        </h1>
        
        <p className="text-pink-800 font-serif italic mb-8">
          (Coming soon - your resonance will shape what happens here)
        </p>

        {seed && (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 mb-6">
            <p className="text-sm text-pink-700 font-mono mb-2">Seed: {seed}</p>
          </div>
        )}

        {affect && (
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 text-left max-w-md">
            <h3 className="text-lg font-serif text-pink-900 mb-4">Your Affect Vector:</h3>
            <div className="grid grid-cols-2 gap-3 text-sm text-pink-800">
              <div>
                <span className="font-semibold">Valence:</span> {affect.valence.toFixed(2)}
              </div>
              <div>
                <span className="font-semibold">Arousal:</span> {affect.arousal.toFixed(2)}
              </div>
              <div>
                <span className="font-semibold">Depth:</span> {affect.depth.toFixed(2)}
              </div>
              <div>
                <span className="font-semibold">Clarity:</span> {affect.clarity.toFixed(2)}
              </div>
              <div>
                <span className="font-semibold">Authenticity:</span> {affect.authenticity.toFixed(2)}
              </div>
              <div>
                <span className="font-semibold">Effort:</span> {affect.effort.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        <motion.a
          href="/awakening"
          className="mt-8 inline-block px-8 py-3 bg-gradient-to-r from-pink-400 to-rose-400 text-white rounded-full font-medium shadow-lg hover:shadow-xl transition-shadow"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Back to Awakening
        </motion.a>
      </motion.div>
    </section>
  );
}

export default function SpinPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-100 to-pink-100">
        <p className="text-pink-700/60 animate-pulse">Loading...</p>
      </div>
    }>
      <SpinContent />
    </Suspense>
  );
}
