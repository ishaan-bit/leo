/**
 * NextAuth Configuration
 * Centralized auth config to avoid circular dependencies
 */

import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      id: 'phone-otp',
      name: 'Phone OTP',
      credentials: {
        phoneNumber: { label: "Phone Number", type: "text" },
        code: { label: "Verification Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.phoneNumber || !credentials?.code) {
          throw new Error('Phone number and code are required');
        }

        try {
          // Verify the OTP code via our API
          const verifyRes = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phoneNumber: credentials.phoneNumber,
              code: credentials.code,
            }),
          });

          const data = await verifyRes.json();

          if (!data.verified) {
            throw new Error(data.error || 'Invalid verification code');
          }

          // Return user object - phoneNumber becomes the unique ID
          return {
            id: credentials.phoneNumber, // Use phone as unique ID
            name: credentials.phoneNumber,
            email: `${credentials.phoneNumber}@phone.local`, // Fake email for compatibility
            phoneNumber: credentials.phoneNumber,
          };
        } catch (error: any) {
          console.error('[Auth] Phone OTP verification failed:', error);
          throw new Error(error.message || 'Verification failed');
        }
      },
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
