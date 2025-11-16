'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function TermsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 text-pink-600 hover:text-pink-800 transition-colors flex items-center gap-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl font-serif font-semibold text-pink-900 mb-4">Terms of Service</h1>
          <p className="text-sm text-pink-600/70">Last updated: January 2025</p>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-lg space-y-8"
        >
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-serif font-semibold text-pink-900 mb-4">Welcome to QuietDen</h2>
            <p className="text-pink-800/90 leading-relaxed mb-4">
              QuietDen is a gentle wellbeing experience designed to help you reflect, process emotions, and find moments of calm. By using QuietDen, you agree to these terms.
            </p>
            <p className="text-pink-800/90 leading-relaxed">
              This is a space for personal reflection, not medical advice. If you're experiencing a mental health crisis, please reach out to a qualified professional or emergency services.
            </p>
          </section>

          {/* What We Store */}
          <section>
            <h2 className="text-2xl font-serif font-semibold text-pink-900 mb-4">What We Store</h2>
            <p className="text-pink-800/90 leading-relaxed mb-4">
              When you use QuietDen, we store:
            </p>
            <ul className="list-disc list-inside space-y-2 text-pink-800/90 ml-4">
              <li>Your reflections (the text you enter)</li>
              <li>Generated insights, poems, and dream letters based on your reflections</li>
              <li>Your account information (if you sign in with Google)</li>
              <li>Usage data to improve the experience</li>
            </ul>
          </section>

          {/* How We Use Your Data */}
          <section>
            <h2 className="text-2xl font-serif font-semibold text-pink-900 mb-4">How We Use Your Data</h2>
            <p className="text-pink-800/90 leading-relaxed mb-4">
              We use your data to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-pink-800/90 ml-4">
              <li>Generate personalized insights, poems, and dream letters</li>
              <li>Improve the quality of our AI models and experience</li>
              <li>Sync your reflections across devices (if signed in)</li>
            </ul>
            <p className="text-pink-800/90 leading-relaxed mt-4 font-semibold">
              We never sell your data or share it with advertisers.
            </p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-2xl font-serif font-semibold text-pink-900 mb-4">Your Rights</h2>
            <p className="text-pink-800/90 leading-relaxed mb-4">
              You have full control over your data:
            </p>
            <ul className="list-disc list-inside space-y-2 text-pink-800/90 ml-4">
              <li>You can delete all your data at any time from Settings → Privacy & Data</li>
              <li>You can download a copy of your data</li>
              <li>You can use Guest Mode to keep everything local to your device</li>
              <li>You can delete individual reflections or moments</li>
            </ul>
          </section>

          {/* Acceptable Use */}
          <section>
            <h2 className="text-2xl font-serif font-semibold text-pink-900 mb-4">Acceptable Use</h2>
            <p className="text-pink-800/90 leading-relaxed mb-4">
              Please use QuietDen responsibly:
            </p>
            <ul className="list-disc list-inside space-y-2 text-pink-800/90 ml-4">
              <li>Don't use QuietDen to harm, harass, or impersonate anyone</li>
              <li>Don't share sensitive personal information of others</li>
              <li>Don't attempt to exploit or abuse the service</li>
              <li>Don't use QuietDen for illegal activities</li>
            </ul>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-2xl font-serif font-semibold text-pink-900 mb-4">Changes to These Terms</h2>
            <p className="text-pink-800/90 leading-relaxed">
              We may update these terms from time to time. We'll notify you of significant changes through the app or via email (if you're signed in). Continued use of QuietDen after changes means you accept the updated terms.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-serif font-semibold text-pink-900 mb-4">Questions?</h2>
            <p className="text-pink-800/90 leading-relaxed">
              If you have questions about these terms, please reach out to us at{' '}
              <a href="mailto:hello@quietden.com" className="underline hover:text-pink-900 transition-colors">
                hello@quietden.com
              </a>
            </p>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
