import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";

// Shared config: providers + session strategy only — no adapter.
// JWT sessions let this stay decodable without a database, so proxy.ts
// can check auth state without pulling in Prisma (see auth.ts).
export const authConfig: NextAuthConfig = {
  providers: [GitHub],
  session: { strategy: "jwt" },
};

// Prisma-free auth/signIn/signOut for use in proxy.ts and server actions
export const { auth, signIn, signOut } = NextAuth(authConfig);