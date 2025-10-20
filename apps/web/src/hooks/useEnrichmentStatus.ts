import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useEnrichmentStatus - Poll reflection enrichment status
 * 
 * Polls reflection:{rid} from Upstash every 3-4s (with jitter)
 * Checks if `final` field exists (enrichment complete)
 * 
 * Features:
 * - Exponential backoff on errors (8-12s)
 * - Jittered polling to avoid thundering herd
 * - Soft timeout (90s) and hard timeout (150s) tracking
 * - Returns isReady, isLoading, error, elapsedTime
 */

interface UseEnrichmentStatusOptions {
  enabled?: boolean;
  pollInterval?: number; // Base interval in ms (default 3500)
  onTimeout?: () => void;
  softTimeout?: number; // Default 90000ms
  hardTimeout?: number; // Default 150000ms
}

interface UseEnrichmentStatusReturn {
  isReady: boolean;
  isLoading: boolean;
  error: Error | null;
  elapsedTime: number;
  reflection: any | null;
}

export function useEnrichmentStatus(
  reflectionId: string,
  options: UseEnrichmentStatusOptions = {}
): UseEnrichmentStatusReturn {
  const {
    enabled = true,
    pollInterval = 3500,
    onTimeout,
    softTimeout = 90000,
    hardTimeout = 150000,
  } = options;

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [reflection, setReflection] = useState<any | null>(null);

  const startTimeRef = useRef(Date.now());
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const errorCountRef = useRef(0);
  const hasCalledTimeoutRef = useRef(false);

  // Calculate jitter: ±500ms
  const getJitteredInterval = useCallback((base: number) => {
    const jitter = Math.random() * 1000 - 500; // -500 to +500ms
    return Math.max(1000, base + jitter);
  }, []);

  // Calculate backoff interval on errors
  const getBackoffInterval = useCallback((errorCount: number) => {
    // 8-12s backoff on errors
    const base = 8000 + Math.random() * 4000;
    return base * Math.min(errorCount, 3); // Cap at 3x
  }, []);

  // Poll enrichment status
  const checkEnrichmentStatus = useCallback(async () => {
    if (!enabled || !reflectionId) return;

    try {
      const response = await fetch(`/api/reflect/${reflectionId}`);

      if (!response.ok) {
        throw new Error(`Status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setReflection(data);

      // Check if enrichment is complete (has 'final' field)
      if (data.final) {
        setIsReady(true);
        setIsLoading(false);
        
        // Stop polling
        if (pollTimerRef.current) {
          clearTimeout(pollTimerRef.current);
        }

        // Log success
        if (process.env.NODE_ENV === 'development') {
          const duration = Date.now() - startTimeRef.current;
          console.log(`[useEnrichmentStatus] Enrichment ready after ${duration}ms`);
        }

        return;
      }

      // Reset error count on successful poll
      errorCountRef.current = 0;
    } catch (err) {
      console.error('[useEnrichmentStatus] Poll error:', err);
      setError(err as Error);
      errorCountRef.current += 1;
    }

    // Schedule next poll
    if (!isReady && enabled) {
      const nextInterval = errorCountRef.current > 0
        ? getBackoffInterval(errorCountRef.current)
        : getJitteredInterval(pollInterval);

      pollTimerRef.current = setTimeout(checkEnrichmentStatus, nextInterval);
    }
  }, [enabled, reflectionId, pollInterval, isReady, getJitteredInterval, getBackoffInterval]);

  // Start polling when enabled
  useEffect(() => {
    if (enabled && reflectionId) {
      setIsLoading(true);
      startTimeRef.current = Date.now();

      // Initial poll with short delay
      const initialDelay = 500;
      pollTimerRef.current = setTimeout(checkEnrichmentStatus, initialDelay);
    }

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [enabled, reflectionId, checkEnrichmentStatus]);

  // Track elapsed time
  useEffect(() => {
    if (!enabled || isReady) return;

    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setElapsedTime(elapsed);

      // Hard timeout - call callback once
      if (elapsed >= hardTimeout && !hasCalledTimeoutRef.current) {
        hasCalledTimeoutRef.current = true;
        
        if (onTimeout) {
          onTimeout();
        }

        // Stop polling
        if (pollTimerRef.current) {
          clearTimeout(pollTimerRef.current);
        }

        setIsLoading(false);
      }
    }, 500);

    return () => clearInterval(intervalId);
  }, [enabled, isReady, hardTimeout, onTimeout]);

  return {
    isReady,
    isLoading,
    error,
    elapsedTime,
    reflection,
  };
}
