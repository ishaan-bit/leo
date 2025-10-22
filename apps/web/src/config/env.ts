// Environment configuration
// Type-safe environment variables

export const env = {
  // Legacy
  apiUrl: process.env.NEXT_PUBLIC_API_URL || '',
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  
  // Upstash Redis (State Oracle)
  upstashUrl: process.env.NEXT_PUBLIC_UPSTASH_URL || '',
  upstashToken: process.env.NEXT_PUBLIC_UPSTASH_TOKEN || '',
  
  // Project & Environment
  appEnv: process.env.NEXT_PUBLIC_APP_ENV || 'development',
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID || 'leo',
  
  // Runtime Flags
  dataSource: (process.env.DATA_SOURCE || 'upstash') as 'upstash' | 'local',
  interludeVersion: process.env.INTERLUDE_VERSION || 'v1',
} as const;

/**
 * Validate required environment variables
 */
export function validateEnv(): { valid: boolean; missing: string[] } {
  const required = {
    upstashUrl: env.upstashUrl,
    upstashToken: env.upstashToken,
  };
  
  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Check if Upstash is available (for fallback logic)
 */
export function isUpstashAvailable(): boolean {
  return !!(env.upstashUrl && env.upstashToken);
}
