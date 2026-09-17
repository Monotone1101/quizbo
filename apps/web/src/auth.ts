import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@quizbo/db";
import NextAuth, { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

export const authProviders = {
  google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
  email: Boolean(process.env.AUTH_RESEND_KEY),
  demo: process.env.AUTH_DEMO_LOGIN === "true",
};

const providers: NextAuthConfig["providers"] = [];
if (authProviders.google) providers.push(Google);
if (authProviders.email) {
  providers.push(Resend({ from: process.env.AUTH_EMAIL_FROM ?? "Quizbo <login@example.com>" }));
}
if (authProviders.demo || providers.length === 0) {
  // Demo accounts: a display name plus a random key the browser keeps, so the same browser returns
  // to the same account. Enabled with AUTH_DEMO_LOGIN=true (and as a last resort when no provider
  // is configured, so a fresh deployment is never locked out).
  providers.push(
    Credentials({
      id: "demo",
      name: "Demo",
      credentials: { name: { label: "Name" }, key: { label: "Key" } },
      async authorize(credentials) {
        const name = typeof credentials?.name === "string" ? credentials.name.trim().replace(/\s+/g, " ").slice(0, 40) : "";
        const key = typeof credentials?.key === "string" ? credentials.key.trim().toLowerCase() : "";
        if (name.length < 2 || !/^[a-z0-9-]{16,64}$/.test(key)) return null;
        const email = `demo-${key}@demo.quizbo.local`;
        const user = await prisma.user.upsert({
          where: { email },
          update: { name },
          create: { email, name, isDemo: true },
        });
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma as unknown as Parameters<typeof PrismaAdapter>[0]),
  // JWT sessions keep the userId stable across the web app and the battle service, and let the
  // demo credentials provider work alongside OAuth/email.
  session: { strategy: "jwt" },
  providers,
  pages: { signIn: "/signin" },
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
