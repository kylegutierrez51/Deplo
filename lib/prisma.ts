/*
 * Next bundles generated/prisma rather than requiring it, so one dev server holds more than one copy of the
 * Prisma runtime — one per layer (pages and actions are [app-rsc], route handlers are [app-route]), plus a fresh one
 * after every `prisma generate`. 
 * 
 * A client's errors only pass `instanceof` checks in its own copy, so each copy gets
 * its own client, and no copy can ever disconnect each other.
 */

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Types `global` so it can hold a Map from each runtime copy's PrismaClient class to the client built from it.
const globalForPrisma = global as unknown as {
  prismaClients: Map<typeof PrismaClient, PrismaClient> | undefined;
};

// Gets the shared Map off `global`, creating it on the first evaluation of any copy of this file.
const clients = (globalForPrisma.prismaClients ??= new Map());

// Reuses the client this copy's PrismaClient class already built, or builds a new one. Annotated as PrismaClient
// because the inferred union with PrismaClient<{ adapter }> leaves $transaction callbacks with implicitly-any params.
const prisma: PrismaClient = clients.get(PrismaClient)
  ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// Stores the client under this copy's class so the next dev reload of this file finds it. Production never reloads.
if (process.env.NODE_ENV !== "production") clients.set(PrismaClient, prisma);

export default prisma;
