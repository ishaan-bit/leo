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
      {/* Notebook container */}
      <div className="relative bg-white/80 backdrop-blur-sm rounded-lg border border-pink-200 shadow-lg overflow-hidden">
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
        
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full min-h-[200px] p-6 bg-transparent border-none outline-none resize-none font-serif text-lg text-pink-900 placeholder:text-pink-400 placeholder:italic"
          style={{
            lineHeight: '1.75',
          }}
        />
        
        {/* Character count & language indicator */}
        <div className="absolute bottom-3 left-6 text-xs text-pink-500 italic">
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
              px-6 py-2 rounded-full font-medium text-sm
              transition-all duration-300
              ${isValid && !disabled
                ? 'bg-pink-600 text-white hover:bg-pink-700 hover:shadow-lg'
                : 'bg-pink-200 text-pink-400 cursor-not-allowed'
              }
            `}
            whileHover={isValid && !disabled ? { scale: 1.05 } : {}}
            whileTap={isValid && !disabled ? { scale: 0.95 } : {}}
          >
            Let it go
          </motion.button>
        </div>
      </div>
      
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
