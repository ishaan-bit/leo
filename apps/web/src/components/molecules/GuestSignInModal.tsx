'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface GuestSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  pigId: string;
}

export default function GuestSignInModal({ 
  isOpen, 
  onClose,
  pigId 
}: GuestSignInModalProps) {
  const router = useRouter();

  const handleSignIn = () => {
    // Navigate to pig landing page (not direct sign-in)
    router.push(`/p/${pigId}`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />

          {/* Modal - CENTERED properly for mobile, ensure not cut off */}
          <motion.div
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[70] max-w-[280px] mx-auto"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-pink-100 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-br from-pink-50 to-rose-50 px-4 py-4 border-b border-pink-100">
                <h2 className="text-lg md:text-xl font-serif italic text-[#9C1F5F] text-center">
                  Keep your moments safe
                </h2>
              </div>

              {/* Content */}
              <div className="px-4 py-4 space-y-3">
                <p className="text-center text-gray-700 text-sm leading-relaxed">
                  Sign in to keep your moments safe across devices.
                </p>

                <div className="space-y-2.5 pt-1">
                  <button
                    onClick={handleSignIn}
                    className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-5 py-3 rounded-full font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Sign in
                  </button>

                  <button
                    onClick={onClose}
                    className="w-full text-gray-600 hover:text-gray-800 px-5 py-2.5 rounded-full font-medium text-sm transition-colors active:bg-gray-100"
                  >
                    Continue as guest
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
