/**
 * NextAuth Configuration
 * Centralized auth config to avoid circular dependencies
 */

import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/p', // Keep users in the flow
  },
  callbacks: {
    async session({ session, token }) {
      // Add user ID to session
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Handle legacy awakening route
      if (url.includes('/awakening')) {
        return baseUrl;
      }
      // If it's a relative path starting with /, use it
      if (url.startsWith('/')) {
        return url;
      }
      // If it's an absolute URL on our domain, use it
      if (url.startsWith(baseUrl)) {
        return url;
      }
      // Default: stay on base URL
      return baseUrl;
    },
    async signIn({ user, account, profile }) {
      // Log sign-in for debugging
      console.log('🔐 User signed in:', {
        userId: user.id,
        email: user.email,
        provider: account?.provider,
      });
      
      // Note: The actual merge will be triggered by the client
      // after successful sign-in via POST /api/auth/merge
      // This is because we need the session cookie to be set first
      
      return true;
    },
  },
  events: {
    async signIn({ user, account }) {
      // Log the sign-in event
      console.log('📝 SignIn event:', {
        userId: user.id,
        email: user.email,
        provider: account?.provider,
        timestamp: new Date().toISOString(),
      });
      
      // The merge endpoint will be called by the client after redirect
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
