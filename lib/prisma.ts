import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

// A dev reload can load a fresh copy of the Prisma runtime. The client cached on `global` still belongs to the old
// copy, so the errors it throws fail `instanceof` checks against the new error classes, and it has to be replaced.
// Checked by constructor because a PrismaClient is a proxy, which fails `instanceof` even when it is current.
const cached = globalForPrisma.prisma;
const prisma = cached?.constructor === PrismaClient
  ? cached
  : new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

if (cached && cached !== prisma) cached.$disconnect().catch(() => {});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
