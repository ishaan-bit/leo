'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-serif font-semibold text-pink-900 mb-4">Privacy Policy</h1>
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
            <h2 className="text-2xl font-serif font-semibold text-pink-900 mb-4">Your Privacy Matters</h2>
            <p className="text-pink-800/90 leading-relaxed mb-4">
              At QuietDen, your privacy is sacred. We believe your reflections, thoughts, and emotions belong to you. This policy explains how we collect, use, and protect your data.
            </p>
            <p className="text-pink-800/90 leading-relaxed font-semibold">
              We never sell your data. We never share it with advertisers. Period.
            </p>
          </section>

          {/* What We Collect */}
          <section>
            <h2 className="text-2xl font-serif font-semibold text-pink-900 mb-4">What We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-pink-900 mb-2">1. Your Reflections</h3>
                <p className="text-pink-800/90 leading-relaxed">
                  The text you enter into QuietDen is stored to generate insights, poems, and dream letters. In Guest Mode, this data stays on your device. If you sign in, it's securely stored in our database and synced across your devices.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-pink-900 mb-2">2. Account Information</h3>
                <p className="text-pink-800/90 leading-relaxed">
                  If you sign in with Google, we collect your email address and name to identify your account. We don't have access to your Google password.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-pink-900 mb-2">3. Usage Data</h3>
                <p className="text-pink-800/90 leading-relaxed">
                  We collect anonymous usage data (like which features you use, how long you spend in the app) to improve the experience. This data is aggregated and doesn't identify you personally.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-pink-900 mb-2">4. Audio Recordings (Optional)</h3>
                <p className="text-pink-800/90 leading-relaxed">
                  If you use voice input, we temporarily process your audio to convert it to text. We don't store the audio itself—only the transcribed text.
                </p>
              </div>
            </div>
          </section>

          {/* How We Use Your Data */}
          <section>
            <h2 className="text-2xl font-serif font-semibold text-pink-900 mb-4">How We Use Your Data</h2>
            <ul className="list-disc list-inside space-y-2 text-pink-800/90 ml-4">
              <li>To generate personalized insights, poems, and dream letters based on your reflections</li>
              <li>To improve our AI models and make the experience more helpful</li>
              <li>To sync your data across devices (if you're signed in)</li>
              <li>To send you notifications about your dream letters (if enabled)</li>
              <li>To analyze usage patterns and improve the app (anonymously)</li>
            </ul>
          </section>

          {/* Who We Share Data With */}
          <section>
            <h2 className="text-2xl font-serif font-semibold text-pink-900 mb-4">Who We Share Data With</h2>
            <p className="text-pink-800/90 leading-relaxed mb-4">
              We only share your data in these limited cases:
            </p>
            <ul className="list-disc list-inside space-y-2 text-pink-800/90 ml-4">
              <li><strong>AI Processing:</strong> Your reflections are sent to AI providers (like OpenAI) to generate insights and content. These providers are contractually bound to keep your data confidential and not use it for training.</li>
              <li><strong>Hosting & Infrastructure:</strong> We use secure cloud services to store and process your data. These providers don't have access to your content.</li>
              <li><strong>Legal Requirements:</strong> We may share data if required by law, but we'll notify you unless prohibited.</li>
            </ul>
          </section>

          {/* Your Control */}
          <section>
            <h2 className="text-2xl font-serif font-semibold text-pink-900 mb-4">Your Control</h2>
            <p className="text-pink-800/90 leading-relaxed mb-4">
              You have complete control over your data:
            </p>
            <ul className="list-disc list-inside space-y-2 text-pink-800/90 ml-4">
              <li><strong>Delete Everything:</strong> Go to Settings → Privacy & Data → Delete All My Data</li>
              <li><strong>Download Your Data:</strong> Request a copy of all your reflections and generated content</li>
              <li><strong>Guest Mode:</strong> Use QuietDen without signing in—your data stays on your device</li>
              <li><strong>Delete Individual Items:</strong> Remove specific reflections or moments anytime</li>
              <li><strong>Stop Syncing:</strong> Sign out to stop syncing data across devices</li>
            </ul>
          </section>

          {/* Security */}
          <section>
            <h2 className="text-2xl font-serif font-semibold text-pink-900 mb-4">How We Protect Your Data</h2>
            <p className="text-pink-800/90 leading-relaxed mb-4">
              We take security seriously:
            </p>
            <ul className="list-disc list-inside space-y-2 text-pink-800/90 ml-4">
              <li>All data is encrypted in transit (HTTPS) and at rest</li>
              <li>We use industry-standard security practices to protect your information</li>
              <li>Our team follows strict data access policies—only authorized personnel can access user data, and only when necessary for support or debugging</li>
              <li>We regularly review and update our security measures</li>
            </ul>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-2xl font-serif font-semibold text-pink-900 mb-4">Children's Privacy</h2>
            <p className="text-pink-800/90 leading-relaxed">
              QuietDen is not intended for children under 13. We don't knowingly collect data from children. If you're a parent and believe your child has used QuietDen, please contact us so we can delete their data.
            </p>
          </section>

          {/* Changes to This Policy */}
          <section>
            <h2 className="text-2xl font-serif font-semibold text-pink-900 mb-4">Changes to This Policy</h2>
            <p className="text-pink-800/90 leading-relaxed">
              We may update this policy from time to time. We'll notify you of significant changes through the app or via email (if you're signed in). Continued use of QuietDen after changes means you accept the updated policy.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-serif font-semibold text-pink-900 mb-4">Questions or Concerns?</h2>
            <p className="text-pink-800/90 leading-relaxed">
              If you have questions about this privacy policy or how we handle your data, please reach out:{' '}
              <a href="mailto:privacy@quietden.com" className="underline hover:text-pink-900 transition-colors">
                privacy@quietden.com
              </a>
            </p>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
