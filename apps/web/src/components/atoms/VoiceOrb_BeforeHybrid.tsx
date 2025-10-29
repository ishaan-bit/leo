'use client';

/**
 * VoiceOrb - BACKUP VERSION (Before Hybrid Implementation)
 * 
 * This is the backup of VoiceOrb before hybrid transcription changes.
 * Uses MediaRecorder only, shows placeholder text (no actual transcription).
 * 
 * For hybrid version (Web Speech API + Deepgram), see VoiceOrb.tsx
 * 
 * DIAGNOSTIC REPORT:
 * ==================
 * ✅ Permission layer: PASSES - NotAllowedError handled, better error messages added
 * ❌ Recording pipeline: WORKS but no transcription
 * ✅ AudioContext layer: Resumes on mobile
 * ✅ Track verification: Checks enabled/muted/readyState
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { VoiceMetrics } from '@/lib/behavioral/metrics';
import type { ProcessedText } from '@/lib/multilingual/textProcessor';
import { processText } from '@/lib/multilingual/textProcessor';

interface VoiceOrbProps {
  onTranscript?: (processed: ProcessedText, metrics: VoiceMetrics) => void;
  disabled?: boolean;
}

export default function VoiceOrb({ onTranscript, disabled = false }: VoiceOrbProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  
  const [metrics, setMetrics] = useState<VoiceMetrics>({
    speechRate: 0,
    pitchRange: 0,
    pauseDensity: 0,
    amplitudeVariance: 0,
  });

  // Diagnostic: Feature detection
  const detectFeatures = () => {
    const diag: string[] = [];
    
    // Check MediaDevices API
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      diag.push('❌ getUserMedia not supported');
      return diag;
    }
    diag.push('✅ getUserMedia supported');
    
    // Check MediaRecorder
    if (typeof MediaRecorder === 'undefined') {
      diag.push('❌ MediaRecorder not supported');
      return diag;
    }
    diag.push('✅ MediaRecorder supported');
    
    // Check supported mime types (Android Chrome specific)
    const mimeTypes = [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/3gpp',
    ];
    
    const supportedMimes = mimeTypes.filter(mime => 
      MediaRecorder.isTypeSupported(mime)
    );
    
    if (supportedMimes.length === 0) {
      diag.push('❌ No supported audio mime types');
    } else {
      diag.push(`✅ Supported mimes: ${supportedMimes.join(', ')}`);
    }
    
    // Check AudioContext
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      diag.push('❌ AudioContext not supported');
    } else {
      diag.push('✅ AudioContext supported');
    }
    
    return diag;
  };

  // Get best supported mime type for Android
  const getBestMimeType = (): string => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/3gpp', // Android fallback
    ];
    
    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) {
        console.log('[VoiceOrb] Using mime type:', mime);
        return mime;
      }
    }
    
    // Last resort
    console.warn('[VoiceOrb] No preferred mime type supported, using default');
    return '';
  };

  // Start recording with Android Chrome compatibility
  const handleStart = async () => {
    if (disabled) return;
    
    setError(null);
    setTranscript('');
    audioChunksRef.current = [];
    
    // Run diagnostics
    const diag = detectFeatures();
    setDiagnostics(diag);
    console.log('[VoiceOrb] Diagnostics:', diag);
    
    try {
      // Step 1: Request microphone access
      console.log('[VoiceOrb] Step 1: Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000, // Android prefers 48kHz
        }
      });
      
      // Step 2: Verify audio tracks are active
      const audioTracks = stream.getAudioTracks();
      console.log('[VoiceOrb] Step 2: Audio tracks:', audioTracks.length);
      
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks in stream');
      }
      
      const track = audioTracks[0];
      console.log('[VoiceOrb] Track state:', {
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        label: track.label,
      });
      
      if (track.muted) {
        console.warn('[VoiceOrb] ⚠️ Track is muted!');
      }
      
      if (track.readyState !== 'live') {
        throw new Error(`Track not live: ${track.readyState}`);
      }
      
      streamRef.current = stream;
      
      // Step 3: Setup AudioContext (CRITICAL: Resume on mobile)
      console.log('[VoiceOrb] Step 3: Setting up AudioContext...');
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      
      // CRITICAL FIX: Resume AudioContext (suspended by default on mobile)
      if (audioContext.state === 'suspended') {
        console.log('[VoiceOrb] AudioContext suspended, resuming...');
        await audioContext.resume();
      }
      
      console.log('[VoiceOrb] AudioContext state:', audioContext.state);
      audioContextRef.current = audioContext;
      
      // Setup analyser for visualfeedback
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      // Step 4: Create MediaRecorder with Android-compatible settings
      console.log('[VoiceOrb] Step 4: Creating MediaRecorder...');
      const mimeType = getBestMimeType();
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
        audioBitsPerSecond: 128000, // Good quality for speech
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      // Handle data chunks - CRITICAL: Use timeslice for Android
      mediaRecorder.ondataavailable = (event) => {
        console.log('[VoiceOrb] Data chunk received:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onerror = (event: any) => {
        console.error('[VoiceOrb] MediaRecorder error:', event.error);
        setError(`Recording failed: ${event.error?.message || 'Unknown error'}`);
      };
      
      mediaRecorder.onstop = async () => {
        console.log('[VoiceOrb] MediaRecorder stopped, chunks:', audioChunksRef.current.length);
        await handleRecordingComplete();
      };
      
      // Step 5: Start recording with timeslice (CRITICAL for Android)
      // Timeslice = 1000ms ensures chunks arrive even if stop() isn't called cleanly
      console.log('[VoiceOrb] Step 5: Starting recording with 1000ms timeslice...');
      mediaRecorder.start(1000); // Request data every 1 second
      
      console.log('[VoiceOrb] MediaRecorder state:', mediaRecorder.state);
      
      setIsRecording(true);
      startTimeRef.current = Date.now();
      
      // Start audio analysis loop
      const analysisInterval = setInterval(analyzeAudio, 100);
      
      // Store cleanup function
      (window as any).__voiceOrbCleanup = () => {
        clearInterval(analysisInterval);
      };
      
    } catch (err: any) {
      console.error('[VoiceOrb] Error in handleStart:', err);
      
      // Enhanced error messages for debugging
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow access in Settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please check your device.');
      } else if (err.name === 'NotSupportedError') {
        setError('Recording not supported on this browser.');
      } else if (err.name === 'NotReadableError') {
        setError('Microphone is in use by another app.');
      } else {
        setError(`Error: ${err.message || 'Could not access microphone'}`);
      }
    }
  };

  // Stop recording
  const handleStop = () => {
    console.log('[VoiceOrb] handleStop called');
    
    setIsRecording(false);
    
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('[VoiceOrb] Stopping MediaRecorder...');
      mediaRecorderRef.current.stop();
    }
    
    // Cleanup
    if ((window as any).__voiceOrbCleanup) {
      (window as any).__voiceOrbCleanup();
    }
  };

  // Handle recording complete
  const handleRecordingComplete = async () => {
    console.log('[VoiceOrb] handleRecordingComplete');
    setIsProcessing(true);
    
    try {
      // Create blob from chunks
      const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      
      console.log('[VoiceOrb] Audio blob created:', {
        size: audioBlob.size,
        type: audioBlob.type,
        chunks: audioChunksRef.current.length,
      });
      
      if (audioBlob.size === 0) {
        throw new Error('Recording is empty (0 bytes). Microphone may not be capturing audio.');
      }
      
      // For now, use placeholder transcript
      // TODO: Integrate with speech-to-text service (Whisper API, etc.)
      const placeholderText = '[Voice input recorded - transcription pending]';
      setTranscript(placeholderText);
      
      // Calculate metrics
      const duration = (Date.now() - startTimeRef.current) / 1000;
      const wordCount = 10; // Placeholder
      
      const finalMetrics: VoiceMetrics = {
        ...metrics,
        speechRate: wordCount / duration,
        pauseDensity: 0.2, // Placeholder
      };
      
      const processed = processText(placeholderText);
      
      // Notify parent
      if (onTranscript) {
        onTranscript(processed, finalMetrics);
      }
      
      // Optional: Play back to verify recording
      if (typeof window !== 'undefined') {
        const audioUrl = URL.createObjectURL(audioBlob);
        console.log('[VoiceOrb] Audio URL for playback:', audioUrl);
        // Could add: const audio = new Audio(audioUrl); audio.play();
      }
      
    } catch (err: any) {
      console.error('[VoiceOrb] Error processing recording:', err);
      setError(err.message);
    } finally {
      setIsProcessing(false);
      
      // Cleanup stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('[VoiceOrb] Stopped track:', track.label);
        });
        streamRef.current = null;
      }
      
      // Cleanup AudioContext
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    }
  };

  // Analyze audio for visual feedback
  const analyzeAudio = () => {
    if (!analyserRef.current) return;
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    analyser.getByteTimeDomainData(dataArray);
    
    // Calculate amplitude
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += Math.abs(normalized);
    }
    const amplitude = sum / bufferLength;
    
    // Update metrics for visual feedback
    setMetrics(prev => ({
      ...prev,
      amplitudeVariance: amplitude * 100,
    }));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Voice Orb */}
      <motion.button
        onPointerDown={handleStart}
        onPointerUp={handleStop}
        onPointerLeave={() => {
          if (isRecording) handleStop();
        }}
        disabled={disabled || isProcessing}
        className={`
          relative w-32 h-32 rounded-full
          flex items-center justify-center
          transition-all duration-300
          ${disabled || isProcessing
            ? 'bg-pink-200 cursor-not-allowed'
            : isRecording
              ? 'bg-pink-500 shadow-2xl'
              : 'bg-pink-400 hover:bg-pink-500 hover:shadow-xl cursor-pointer'
          }
        `}
        animate={isRecording ? {
          scale: [1, 1.1, 1],
        } : {}}
        transition={{
          duration: 1,
          repeat: isRecording ? Infinity : 0,
          ease: 'easeInOut',
        }}
      >
        {/* Microphone icon */}
        <svg
          className="w-12 h-12 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
        
        {/* Recording pulse rings */}
        <AnimatePresence>
          {isRecording && (
            <>
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full border-2 border-pink-300"
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: 1.5,
                    delay: i * 0.3,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                />
              ))}
            </>
          )}
        </AnimatePresence>
      </motion.button>
      
      {/* Instructions */}
      <div className="text-center">
        <p className="text-sm font-serif italic text-pink-700">
          {isProcessing
            ? 'Processing...'
            : isRecording
              ? 'Recording... Release to finish'
              : 'Press and hold to speak'
          }
        </p>
      </div>
      
      {/* Diagnostics (development only) */}
      {process.env.NODE_ENV === 'development' && diagnostics.length > 0 && (
        <div className="max-w-md p-3 bg-gray-100 rounded text-xs font-mono">
          {diagnostics.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
      )}
      
      {/* Live transcript */}
      <AnimatePresence>
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-md p-4 bg-white/80 backdrop-blur-sm rounded-lg border border-pink-200 text-center"
          >
            <p className="text-sm font-serif text-pink-900 italic">
              "{transcript}"
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-md text-sm text-red-600 italic text-center"
        >
          {error}
        </motion.div>
      )}
    </div>
  );
}
