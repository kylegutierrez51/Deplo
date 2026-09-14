import prisma from "@/lib/prisma";
import { AuditAction, ResourceType } from "@/generated/prisma";
import { Prisma } from '@/generated/prisma';

interface AuditAttrs {
  userId?: string;
  actor?: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId: string;
  resourceLabel?: string;
}

type Db = typeof prisma | Prisma.TransactionClient;


export async function addAudit(attrs: AuditAttrs, db: Db = prisma): Promise<void> {
    await db.auditLog.create({ data: { ...attrs } });
}