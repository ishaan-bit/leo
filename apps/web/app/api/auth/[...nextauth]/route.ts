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
      // ALWAYS redirect to awakening scene after authentication
      // Any /reflect routes get redirected
      if (url.includes('/reflect')) {
        return `${baseUrl}/awakening`;
      }
      // If it's a relative path starting with /, check it
      if (url.startsWith('/')) {
        return url;
      }
      // If it's an absolute URL on our domain
      if (url.startsWith(baseUrl)) {
        return url;
      }
      // Default: go to awakening
      return `${baseUrl}/awakening`;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
