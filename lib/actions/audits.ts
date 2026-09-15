import prisma from "@/lib/prisma";
import { AuditAction, ResourceType } from "@/generated/prisma";
import { Prisma } from '@/generated/prisma';

interface AuditAttrs {
  userId: string | null;
  actor: string | null;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId: string;
  resourceLabel: string | null;
}

type Db = typeof prisma | Prisma.TransactionClient;


export async function addAudit(attrs: AuditAttrs, db: Db = prisma): Promise<void> {
    await db.auditLog.create({ data: { ...attrs } });
}