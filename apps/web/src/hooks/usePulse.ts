'use client';

/**
 * usePulse - Breathing animation hook
 * Returns smooth pulse cycle values derived from arousal and valence
 * 
 * Motion Formula:
 * pulseStrength = 0.4 + (arousal * 0.6)
 * warmth = 0.5 + (valence * 0.5)
 * 
 * phaseOffset creates rhythm difference between zones (~15-20%)
 */

import { useEffect, useState } from 'react';
import { useSpring, useTransform, useMotionValue } from 'framer-motion';

interface PulseConfig {
  arousal: number;    // 0..1
  valence: number;    // -1..1
  phaseOffset?: number; // 0..1 (for alternating rhythm)
}

interface PulseValues {
  opacity: number;
  scale: number;
  hueShift: number;
  pulseStrength: number;
  warmth: number;
}

const PULSE_DURATION = 8000; // 8s breathing cycle

export function usePulse({
  arousal,
  valence,
  phaseOffset = 0,
}: PulseConfig): PulseValues {
  const [time, setTime] = useState(0);

  // Derived constants
  const pulseStrength = 0.4 + (arousal * 0.6);
  const warmth = 0.5 + (valence * 0.5);

  // Spring-driven smooth values
  const rawOpacity = useMotionValue(0.5);
  const rawScale = useMotionValue(1);
  const rawHueShift = useMotionValue(0);

  const opacity = useSpring(rawOpacity, {
    stiffness: 50,
    damping: 20,
  });

  const scale = useSpring(rawScale, {
    stiffness: 40,
    damping: 25,
  });

  const hueShift = useSpring(rawHueShift, {
    stiffness: 30,
    damping: 30,
  });

  // Animation loop
  useEffect(() => {
    let rafId: number;
    let startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const phaseAdjusted = elapsed + (phaseOffset * PULSE_DURATION);
      const t = (phaseAdjusted % PULSE_DURATION) / PULSE_DURATION;

      // Smooth sine wave for breathing
      const sineWave = Math.sin(t * Math.PI * 2);
      const smoothT = (sineWave + 1) / 2; // Normalize to 0..1

      // Opacity: subtle pulse
      const opacityMin = 0.7;
      const opacityMax = 0.95;
      const targetOpacity = opacityMin + (smoothT * (opacityMax - opacityMin) * pulseStrength);
      rawOpacity.set(targetOpacity);

      // Scale: gentle breathing
      const scaleMin = 0.98;
      const scaleMax = 1.02;
      const targetScale = scaleMin + (smoothT * (scaleMax - scaleMin) * pulseStrength);
      rawScale.set(targetScale);

      // Hue shift: warm/cool oscillation based on valence
      // Positive valence = warmer hues (+), negative = cooler (-)
      const hueRange = 15; // +/- 15 degrees
      const targetHue = (smoothT - 0.5) * hueRange * warmth;
      rawHueShift.set(targetHue);

      setTime(t);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [arousal, valence, phaseOffset, pulseStrength, warmth, rawOpacity, rawScale, rawHueShift]);

  return {
    opacity: opacity.get(),
    scale: scale.get(),
    hueShift: hueShift.get(),
    pulseStrength,
    warmth,
  };
}
