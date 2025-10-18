'use client';

import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';

interface SpeechBubbleProps {
  text: string;
  isThinking?: boolean;
}

export default function SpeechBubble({ 
  text, 
  isThinking = false 
}: SpeechBubbleProps) {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  
  // Sanitize and deduplicate lines
  const lines = useMemo(() => {
    const sanitized = text
      .split('\n')
      .map(line => line.trim()) // Trim spaces
      .filter(line => line.length > 0) // Remove empty lines
      .map(line => line.replace(/\s+-\s+/g, '; ')); // Replace " - " with "; "
    
    // Remove duplicates while preserving order
    const seen = new Set<string>();
    return sanitized.filter(line => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    });
  }, [text]);

  useEffect(() => {
    setVisibleLines([]);
    const timers: NodeJS.Timeout[] = [];
    
    lines.forEach((line, index) => {
      const timer = setTimeout(() => {
        setVisibleLines(prev => [...prev, line]);
      }, index * 150);
      timers.push(timer);
    });

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [lines]);

  return (
    <motion.div
      className="relative w-[85%] max-w-lg mx-auto"
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ 
        opacity: 1, 
        scale: 1, 
        y: [-2, 2, -2]
      }}
      transition={{ 
        opacity: { duration: 0.5, delay: 0.3 },
        scale: { type: 'spring', stiffness: 200, damping: 20, delay: 0.3 },
        y: { duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }
      }}
    >
      {/* Speech bubble tail pointing UP to pig */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-white/70 backdrop-blur-md rotate-45 -z-10" />
      
      <div className="relative glass bg-white/70 backdrop-blur-xl rounded-3xl px-8 py-6"
        style={{
          boxShadow: '0 8px 32px rgba(251,113,133,0.15)'
        }}
      >
        <div className="text-center space-y-2">
          {visibleLines.map((line, index) => (
            <motion.p
              key={`${index}-${line.substring(0, 10)}`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.15 }}
              className="italic text-lg"
              style={{ 
                fontFamily: "'DM Serif Text', Georgia, serif", 
                lineHeight: '1.7',
                color: '#6D1B36'
              }}
            >
              {line}
            </motion.p>
          ))}
        </div>
        
        {/* Thinking dots animation */}
        {isThinking && (
          <div className="flex gap-1 justify-center mt-3">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-pink-400 rounded-full"
                animate={{
                  y: [-3, 0, -3],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
