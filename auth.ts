// NextAuth configuration
// auth, handlers, signIn, signOut are all functions 

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaClient } from "@/generated/prisma";
import { PrismaAdapter } from "@auth/prisma-adapter";

const prisma = new PrismaClient();

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub], // reads github env vars
  adapter: PrismaAdapter(prisma) // this automatically populates tables in your database with the info of the user who's authenticated (as long as you have the schema setup for next-auth) 
});