// NextAuth configuration
// auth, handlers, signIn, signOut are all functions 

import NextAuth from "next-auth";
import { PrismaClient } from "@/generated/prisma";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authConfig } from "@/auth.config";

const prisma = new PrismaClient();

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma) // this automatically populates tables in your database with the info of the user who's authenticated (as long as you have the schema setup for next-auth)
});