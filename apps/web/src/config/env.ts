// Environment configuration
// Type-safe environment variables

export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || '',
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
};
