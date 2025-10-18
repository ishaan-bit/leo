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
      // Always redirect to awakening after sign-in
      // If url is relative, use it, otherwise default to /awakening
      if (url.startsWith('/')) {
        // Relative URL - check if it's a specific callback
        return url === '/reflect' || url.includes('/reflect/') ? '/awakening' : url;
      }
      // Absolute URL - check if it's on our domain
      if (url.startsWith(baseUrl)) {
        const path = url.replace(baseUrl, '');
        return path === '/reflect' || path.includes('/reflect/') ? '/awakening' : path;
      }
      // Default fallback
      return '/awakening';
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
