'use client';

/**
 * Voice Orb Test Page - Android Chrome Diagnostic
 * 
 * VERIFICATION TEST:
 * ==================
 * 1. Open on Android Chrome: https://[your-domain]/test/voice
 * 2. Grant microphone permission when prompted
 * 3. Check diagnostics output (supported features)
 * 4. Press and hold orb, speak for 3-5 seconds
 * 5. Release orb
 * 6. Check console for:
 *    - ✅ Data chunks received (non-zero bytes)
 *    - ✅ Audio blob size > 0
 *    - ✅ Track state: enabled=true, muted=false, readyState=live
 *    - ✅ AudioContext state: running
 *    - ✅ MediaRecorder state: recording
 * 7. If blob size = 0 → Check track.muted or AudioContext.state
 * 8. If permission denied → Check Chrome settings → Site settings → Microphone
 * 
 * EXPECTED RESULT:
 * ================
 * - Green diagnostics (all features supported)
 * - Non-zero blob size after recording
 * - "[Voice input recorded]" message appears
 * - No error messages
 * 
 * COMMON ANDROID CHROME ISSUES:
 * ==============================
 * Issue 1: "AudioContext suspended"
 *   → Fix: Added audioContext.resume() before recording
 * 
 * Issue 2: "0-byte blob"
 *   → Fix: Added timeslice=1000ms to MediaRecorder.start()
 * 
 * Issue 3: "Track muted"
 *   → Fix: Check track.muted, track.enabled before recording
 * 
 * Issue 4: "No data chunks"
 *   → Fix: Use supported mime type (audio/webm, audio/3gpp)
 * 
 * Issue 5: "Permission granted but silent"
 *   → Fix: Verify AudioContext.state=running, track.readyState=live
 */

import VoiceOrbAndroidFixed from '@/components/atoms/VoiceOrb_AndroidFix';
import type { ProcessedText } from '@/lib/multilingual/textProcessor';
import type { VoiceMetrics } from '@/lib/behavioral/metrics';

export default function VoiceTestPage() {
  const handleTranscript = (processed: ProcessedText, metrics: VoiceMetrics) => {
    console.log('=== VOICE INPUT COMPLETE ===');
    console.log('Processed text:', processed);
    console.log('Metrics:', metrics);
    console.log('===========================');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dusk-cream via-dusk-blush to-dusk-lavender/30 flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-display text-dusk-plum">
            Voice Orb Test
          </h1>
          <p className="text-sm font-sans text-dusk-wine/70 italic">
            Android Chrome Microphone Diagnostic
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-dusk-mauve/20 space-y-4">
          <h2 className="text-xl font-display text-dusk-plum">
            Test Instructions
          </h2>
          <ol className="space-y-2 text-sm font-sans text-dusk-wine/80 list-decimal list-inside">
            <li>Check diagnostics below the orb (green = good)</li>
            <li>Press and hold the pink orb</li>
            <li>Speak for 3-5 seconds</li>
            <li>Release the orb</li>
            <li>Open browser console (Chrome menu → More tools → Developer tools)</li>
            <li>Look for "[VoiceOrb] Audio blob created: size: XXX bytes"</li>
            <li>If size &gt; 0: ✅ Recording works!</li>
            <li>If size = 0: ❌ Check diagnostic logs below</li>
          </ol>
        </div>

        {/* Voice Orb Component */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-12 border border-dusk-mauve/20 flex flex-col items-center">
          <VoiceOrbAndroidFixed onTranscript={handleTranscript} />
        </div>

        {/* Expected Console Output */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-dusk-mauve/20 space-y-4">
          <h2 className="text-xl font-display text-dusk-plum">
            Expected Console Output
          </h2>
          <pre className="text-xs font-mono bg-black/80 text-green-400 p-4 rounded-lg overflow-x-auto">
{`[VoiceOrb] Diagnostics: [
  "✅ getUserMedia supported",
  "✅ MediaRecorder supported",
  "✅ Supported mimes: audio/webm;codecs=opus, audio/webm",
  "✅ AudioContext supported"
]
[VoiceOrb] Step 1: Requesting microphone access...
[VoiceOrb] Step 2: Audio tracks: 1
[VoiceOrb] Track state: {
  enabled: true,
  muted: false,
  readyState: "live",
  label: "Default Audio Device"
}
[VoiceOrb] Step 3: Setting up AudioContext...
[VoiceOrb] AudioContext state: running
[VoiceOrb] Step 4: Creating MediaRecorder...
[VoiceOrb] Using mime type: audio/webm;codecs=opus
[VoiceOrb] Step 5: Starting recording with 1000ms timeslice...
[VoiceOrb] MediaRecorder state: recording
[VoiceOrb] Data chunk received: 1024 bytes
[VoiceOrb] Data chunk received: 2048 bytes
[VoiceOrb] MediaRecorder stopped, chunks: 3
[VoiceOrb] Audio blob created: {
  size: 8192,
  type: "audio/webm;codecs=opus",
  chunks: 3
}`}
          </pre>
        </div>

        {/* Troubleshooting */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-dusk-mauve/20 space-y-4">
          <h2 className="text-xl font-display text-dusk-plum">
            Troubleshooting
          </h2>
          <div className="space-y-3 text-sm font-sans text-dusk-wine/80">
            <div>
              <span className="font-semibold">❌ "No audio tracks in stream"</span>
              <p className="ml-4 text-xs">→ Permission denied or microphone unavailable</p>
            </div>
            <div>
              <span className="font-semibold">❌ "Track is muted!"</span>
              <p className="ml-4 text-xs">→ Android may have muted the track. Check system settings.</p>
            </div>
            <div>
              <span className="font-semibold">❌ "AudioContext suspended"</span>
              <p className="ml-4 text-xs">→ Should auto-resume. If not, tap screen before recording.</p>
            </div>
            <div>
              <span className="font-semibold">❌ "Recording is empty (0 bytes)"</span>
              <p className="ml-4 text-xs">→ MediaRecorder not receiving data. Check supported mime types.</p>
            </div>
            <div>
              <span className="font-semibold">❌ "No supported audio mime types"</span>
              <p className="ml-4 text-xs">→ Browser too old. Update Chrome to latest version.</p>
            </div>
          </div>
        </div>

        {/* Back button */}
        <div className="text-center">
          <a
            href="/"
            className="inline-block px-6 py-3 bg-dusk-plum hover:bg-dusk-wine text-white rounded-full font-sans text-sm transition-colors"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
