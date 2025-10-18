'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { processText, validateReflection, type ProcessedText } from '@/lib/multilingual/textProcessor';
import type { TypingMetrics } from '@/lib/behavioral/metrics';

interface NotebookInputProps {
  onTextChange?: (text: string, metrics: TypingMetrics) => void;
  onSubmit?: (processed: ProcessedText, metrics: TypingMetrics) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function NotebookInput({
  onTextChange,
  onSubmit,
  placeholder = "Tell me — what stirred something in you today, big or small?",
  disabled = false,
}: NotebookInputProps) {
  const [text, setText] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Typing metrics state
  const [metrics, setMetrics] = useState<TypingMetrics>({
    speedMsPerChar: [],
    pauseLengths: [],
    backspaceCount: 0,
    totalChars: 0,
  });
  
  const lastKeystrokeTime = useRef<number>(Date.now());
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const rippleIdCounter = useRef(0);
  const [typingIntensity, setTypingIntensity] = useState(0); // 0-1 based on typing speed
  const [isFocused, setIsFocused] = useState(false);

  // Track typing metrics
  useEffect(() => {
    const now = Date.now();
    const timeSinceLastKey = now - lastKeystrokeTime.current;
    
    if (timeSinceLastKey > 100) {
      // Record pause if longer than 100ms
      setMetrics(prev => ({
        ...prev,
        pauseLengths: [...prev.pauseLengths, timeSinceLastKey],
      }));
    }
    
    lastKeystrokeTime.current = now;
  }, [text]);

  // Handle text change with metrics tracking
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const now = Date.now();
    const timeSinceLastKey = now - lastKeystrokeTime.current;
    
    // Calculate typing intensity (faster typing = higher glow)
    // Convert ms to intensity: <100ms = 1.0, >1000ms = 0
    const intensity = Math.max(0, Math.min(1, 1 - (timeSinceLastKey / 1000)));
    setTypingIntensity(intensity);
    
    // Check if backspace was pressed
    const isBackspace = newText.length < text.length;
    
    // Update metrics
    setMetrics(prev => {
      const newMetrics = {
        ...prev,
        speedMsPerChar: timeSinceLastKey < 5000 
          ? [...prev.speedMsPerChar, timeSinceLastKey]
          : prev.speedMsPerChar,
        backspaceCount: isBackspace ? prev.backspaceCount + 1 : prev.backspaceCount,
        totalChars: newText.length,
      };
      
      // Notify parent of change
      if (onTextChange) {
        onTextChange(newText, newMetrics);
      }
      
      return newMetrics;
    });
    
    setText(newText);
    lastKeystrokeTime.current = now;
    
    // Validate
    const validation = validateReflection(newText);
    setIsValid(validation.valid);
    setValidationMessage(validation.reason || null);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // Handle key press for ripple effect
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!textareaRef.current) return;
    
    // Create ripple at cursor position
    const rect = textareaRef.current.getBoundingClientRect();
    const x = rect.width / 2; // Center horizontally
    const lineHeight = 28; // Approximate line height
    const lines = text.split('\n').length;
    const y = Math.min(lines * lineHeight, rect.height - 20);
    
    const rippleId = rippleIdCounter.current++;
    setRipples(prev => [...prev, { id: rippleId, x, y }]);
    
    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== rippleId));
    }, 800);
  };

  // Handle submit
  const handleSubmit = () => {
    if (!isValid || disabled) return;
    
    const processed = processText(text);
    
    if (onSubmit) {
      onSubmit(processed, metrics);
    }
  };

  return (
    <div className="relative w-full max-w-2xl">
      {/* Notebook container with journal aesthetic */}
      <motion.div 
        className="relative bg-[#fefbf5] backdrop-blur-sm rounded-lg border-2 border-pink-200/60 shadow-2xl overflow-hidden"
        style={{
          backgroundImage: `
            linear-gradient(90deg, transparent 0, transparent calc(100% - 1px), rgba(251, 207, 232, 0.1) calc(100% - 1px)),
            linear-gradient(rgba(251, 207, 232, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 100% 28px',
          boxShadow: `
            0 4px 20px rgba(251, 113, 133, ${0.1 + typingIntensity * 0.2}),
            inset 0 1px 0 rgba(255, 255, 255, 0.8),
            inset 0 -1px 0 rgba(251, 113, 133, 0.1)
          `,
        }}
        animate={{
          boxShadow: [
            `0 4px 20px rgba(251, 113, 133, ${0.1 + typingIntensity * 0.2}), inset 0 1px 0 rgba(255, 255, 255, 0.8), inset 0 -1px 0 rgba(251, 113, 133, 0.1)`,
            `0 6px 24px rgba(251, 113, 133, ${0.15 + typingIntensity * 0.25}), inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 0 rgba(251, 113, 133, 0.15)`,
            `0 4px 20px rgba(251, 113, 133, ${0.1 + typingIntensity * 0.2}), inset 0 1px 0 rgba(255, 255, 255, 0.8), inset 0 -1px 0 rgba(251, 113, 133, 0.1)`,
          ],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Paper texture overlay */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence baseFrequency=\'0.9\' numOctaves=\'3\'/%3E%3C/filter%3E%3Crect width=\'100\' height=\'100\' filter=\'url(%23noise)\' opacity=\'0.05\'/%3E%3C/svg%3E")',
          }}
        />
        
        {/* Stitched edge effect - left margin */}
        <div className="absolute left-0 top-0 bottom-0 w-16 border-r border-dashed border-pink-300/40" />
        
        {/* Typing glow effect */}
        {isFocused && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 50% 50%, rgba(251, 113, 133, ${typingIntensity * 0.08}), transparent 70%)`,
            }}
            animate={{
              opacity: [0.5, 1, 0.5],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        {/* Ink ripple effects */}
        {ripples.map(ripple => (
          <motion.div
            key={ripple.id}
            className="absolute pointer-events-none rounded-full bg-pink-300/30"
            style={{
              left: ripple.x,
              top: ripple.y,
            }}
            initial={{ width: 0, height: 0, opacity: 0.6 }}
            animate={{ 
              width: 100, 
              height: 100, 
              opacity: 0,
              x: -50,
              y: -50,
            }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        ))}
        
        {/* Textarea with pen cursor */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full min-h-[200px] p-6 pl-20 bg-transparent border-none outline-none resize-none font-serif text-lg text-pink-900 placeholder:text-pink-400/70 placeholder:italic"
          style={{
            lineHeight: '1.75',
            cursor: 'text',
            textShadow: '0 1px 0 rgba(251, 207, 232, 0.3)',
          }}
        />
        
        {/* Character count & language indicator */}
        <div className="absolute bottom-3 left-20 text-xs text-pink-500/70 italic">
          {text.length > 0 && (
            <>
              {text.length} characters
              {processText(text).detectedLanguage !== 'en' && (
                <span className="ml-3 text-pink-600">
                  ({processText(text).detectedLanguage})
                </span>
              )}
            </>
          )}
        </div>
        
        {/* Submit button */}
        <div className="absolute bottom-3 right-3">
          <motion.button
            onClick={handleSubmit}
            disabled={!isValid || disabled}
            className={`
              px-6 py-2 rounded-full font-serif text-sm
              transition-all duration-300
              ${isValid && !disabled
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white hover:from-pink-700 hover:to-rose-700 shadow-lg hover:shadow-xl'
                : 'bg-pink-200/50 text-pink-400/70 cursor-not-allowed'
              }
            `}
            whileHover={isValid && !disabled ? { scale: 1.05, y: -2 } : {}}
            whileTap={isValid && !disabled ? { scale: 0.95 } : {}}
            animate={isValid && !disabled ? {
              boxShadow: [
                '0 4px 20px rgba(251, 113, 133, 0.3)',
                '0 6px 24px rgba(251, 113, 133, 0.4)',
                '0 4px 20px rgba(251, 113, 133, 0.3)',
              ],
            } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            Let it go
          </motion.button>
        </div>
      </motion.div>
      
      {/* Validation message */}
      {validationMessage && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-sm text-pink-600 italic text-center"
        >
          {validationMessage}
        </motion.div>
      )}
    </div>
  );
}
