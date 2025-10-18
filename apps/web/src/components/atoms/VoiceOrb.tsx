'use client';

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
  
  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Voice metrics
  const [metrics, setMetrics] = useState<VoiceMetrics>({
    speechRate: 0,
    pitchRange: 0,
    pauseDensity: 0,
    amplitudeVariance: 0,
  });

  // Initialize Web Speech API
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Voice input not supported in this browser');
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US'; // Will auto-detect but starts with English
    
    // Handle results
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPart + ' ';
        } else {
          interimTranscript += transcriptPart;
        }
      }
      
      setTranscript(finalTranscript || interimTranscript);
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        setError('Could not understand speech');
      }
    };
    
    recognition.onend = () => {
      if (isRecording) {
        // Restart if still recording (handles auto-stop)
        recognition.start();
      }
    };
    
    recognitionRef.current = recognition;
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isRecording]);

  // Calculate voice metrics from audio stream
  const analyzeAudio = () => {
    if (!analyserRef.current) return;
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const pitchArray = new Float32Array(bufferLength);
    
    analyser.getByteTimeDomainData(dataArray);
    analyser.getFloatFrequencyData(pitchArray);
    
    // Calculate amplitude variance
    let sum = 0;
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized;
      sumSquares += normalized * normalized;
    }
    const mean = sum / bufferLength;
    const variance = Math.sqrt(sumSquares / bufferLength - mean * mean);
    
    // Calculate pitch range (simplified)
    const maxPitch = Math.max(...Array.from(pitchArray));
    const minPitch = Math.min(...Array.from(pitchArray));
    const pitchRange = maxPitch - minPitch;
    
    setMetrics(prev => ({
      ...prev,
      amplitudeVariance: variance * 100, // Scale to ~0-50
      pitchRange: Math.abs(pitchRange), // Hz spread
    }));
  };

  // Start recording
  const handleStart = async () => {
    if (disabled) return;
    
    setError(null);
    setTranscript('');
    
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Setup audio analysis
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      // Start speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
      
      setIsRecording(true);
      startTimeRef.current = Date.now();
      
      // Start audio analysis loop
      const analysisInterval = setInterval(analyzeAudio, 100);
      
      // Cleanup on stop
      return () => {
        clearInterval(analysisInterval);
      };
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone');
    }
  };

  // Stop recording
  const handleStop = () => {
    setIsRecording(false);
    setIsProcessing(true);
    
    // Stop speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    // Stop audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    // Calculate final metrics
    const duration = (Date.now() - startTimeRef.current) / 1000; // seconds
    const wordCount = transcript.split(/\s+/).filter(w => w.length > 0).length;
    const speechRate = wordCount / duration;
    
    // Estimate pause density (simplified - would need more sophisticated analysis)
    const pauseDensity = Math.max(0, Math.min(1, (duration - wordCount * 0.3) / duration));
    
    const finalMetrics: VoiceMetrics = {
      ...metrics,
      speechRate,
      pauseDensity,
    };
    
    // Process transcript
    const processed = processText(transcript);
    
    setIsProcessing(false);
    
    // Notify parent
    if (onTranscript) {
      onTranscript(processed, finalMetrics);
    }
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
              ? 'Listening... Release to finish'
              : 'Press and hold to speak'
          }
        </p>
      </div>
      
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
          className="text-sm text-red-600 italic"
        >
          {error}
        </motion.div>
      )}
    </div>
  );
}
