import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const handler = NextAuth({
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
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
