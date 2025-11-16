'use client';

import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={() => router.back()}
            className="mb-6 text-pink-600 hover:text-pink-800 transition-colors flex items-center gap-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-serif font-semibold text-pink-900">Settings</h1>
        </div>

        {/* Account Section */}
        {session && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg"
          >
            <h2 className="text-xl font-serif font-semibold text-pink-900 mb-4">Account</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-pink-800">Signed in as</span>
                <span className="text-sm font-medium text-pink-900">{session.user?.email}</span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/start' })}
                className="w-full bg-pink-100 hover:bg-pink-200 text-pink-900 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </motion.section>
        )}

        {/* Privacy & Data Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg"
        >
          <h2 className="text-xl font-serif font-semibold text-pink-900 mb-4">Privacy & Data</h2>
          <div className="space-y-3">
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete all your data? This cannot be undone.')) {
                  // TODO: Implement data deletion
                  alert('Data deletion will be implemented soon.');
                }
              }}
              className="w-full bg-red-50 hover:bg-red-100 text-red-900 font-semibold py-2 px-4 rounded-lg transition-colors text-left"
            >
              Delete All My Data
            </button>
            <button
              onClick={() => {
                // TODO: Implement data export
                alert('Data export will be implemented soon.');
              }}
              className="w-full bg-pink-100 hover:bg-pink-200 text-pink-900 font-semibold py-2 px-4 rounded-lg transition-colors text-left"
            >
              Download My Data
            </button>
          </div>
        </motion.section>

        {/* Legal & Privacy Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8 bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg"
        >
          <h2 className="text-xl font-serif font-semibold text-pink-900 mb-4">Legal & Privacy</h2>
          <div className="space-y-3">
            <Link
              href="/terms"
              className="block w-full bg-pink-50 hover:bg-pink-100 text-pink-900 font-medium py-2 px-4 rounded-lg transition-colors text-left"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="block w-full bg-pink-50 hover:bg-pink-100 text-pink-900 font-medium py-2 px-4 rounded-lg transition-colors text-left"
            >
              Privacy Policy
            </Link>
          </div>
        </motion.section>

        {/* About Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-lg"
        >
          <h2 className="text-xl font-serif font-semibold text-pink-900 mb-4">About</h2>
          <div className="space-y-2 text-sm text-pink-800">
            <p className="font-medium">QuietDen</p>
            <p className="text-xs text-pink-600/70">Version 1.0.0</p>
            <p className="text-xs text-pink-600/70 mt-4">
              A gentle space for reflection and wellbeing.
            </p>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
