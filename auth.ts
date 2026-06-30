// NextAuth configuration
// auth, handlers, signIn, signOut are all functions 

import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authConfig } from "@/auth.config";
import prisma from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma), // this automatically populates tables in your database with the info of the user who's authenticated (as long as you have the schema setup for next-auth)
  callbacks: {
    jwt({ token, user }) {
       if (user) token.sub = user.id;
       return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    }
  }
});