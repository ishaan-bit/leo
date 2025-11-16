'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LegalModal({ isOpen, onClose }: LegalModalProps) {
  // Disable body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
            onClick={onClose}
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ 
                type: 'spring',
                damping: 25,
                stiffness: 300,
              }}
              className="relative w-full max-w-lg max-h-[70vh] bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-gradient-to-br from-pink-50 to-rose-50 border-b border-pink-200/50 px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-serif font-semibold text-pink-900">
                  Before You Continue
                </h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-pink-200/50 transition-colors text-pink-900"
                  aria-label="Close modal"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto px-6 py-6 space-y-5 max-h-[calc(70vh-140px)]">
                {/* Section 1 */}
                <div>
                  <p className="font-semibold text-pink-900 mb-2">
                    Your privacy matters here.
                  </p>
                  <p className="text-sm text-pink-800/90 leading-relaxed">
                    QuietDen stores your reflections only so your little city can understand you, create your poems, rituals, and dream letters. We never sell your data, never share it with advertisers, and only use it to make your experience gentler and more personal.
                  </p>
                </div>

                {/* Section 2 */}
                <div>
                  <p className="font-semibold text-pink-900 mb-2">
                    When you continue:
                  </p>
                  <ul className="text-sm text-pink-800/90 leading-relaxed space-y-1.5 list-disc list-inside">
                    <li>You allow us to save your reflections (as text you enter).</li>
                    <li>You allow us to process them to generate emotional insights, poems, and dream letters.</li>
                    <li>You can delete everything at any time from Settings → Privacy & Data.</li>
                    <li>If you sign in, your reflections sync across devices.</li>
                    <li>If you stay in Guest Mode, everything stays on your device unless you clear app data.</li>
                  </ul>
                </div>

                {/* Section 3 */}
                <div>
                  <p className="font-semibold text-pink-900 mb-2">
                    A few simple rules:
                  </p>
                  <ul className="text-sm text-pink-800/90 leading-relaxed space-y-1.5 list-disc list-inside">
                    <li>Don't use QuietDen to harm, harass, or impersonate anyone.</li>
                    <li>Don't share sensitive or illegal content.</li>
                    <li>This is a wellbeing experience, not medical advice.</li>
                  </ul>
                </div>

                {/* Section 4 */}
                <div>
                  <p className="font-semibold text-pink-900 mb-2">
                    Your choices:
                  </p>
                  <ul className="text-sm text-pink-800/90 leading-relaxed space-y-1.5 list-disc list-inside">
                    <li>You can download or delete all your data anytime.</li>
                    <li>You control what you write, save, or erase.</li>
                    <li>Leaving Guest Mode is optional. Your Pig will never force you.</li>
                  </ul>
                </div>

                {/* Final paragraph */}
                <div className="pt-2">
                  <p className="font-semibold text-pink-900 mb-2">
                    By continuing, you agree to these terms.
                  </p>
                  <p className="text-sm text-pink-800/90 leading-relaxed">
                    You can read the full versions anytime in Settings → Legal & Privacy.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-gradient-to-br from-pink-50 to-rose-50 border-t border-pink-200/50 px-6 py-4">
                <button
                  onClick={onClose}
                  className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold py-3 px-6 rounded-full shadow-lg hover:shadow-xl hover:from-pink-600 hover:to-rose-600 transition-all duration-300"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
