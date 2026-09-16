import prisma from "@/lib/prisma";
import { AuditAction, ResourceType } from "@/generated/prisma";
import { Prisma } from '@/generated/prisma';
import type { AuditMeta } from '@/lib/types';

interface AuditAttrs {
  userId: string | null;
  actor: string | null;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId: string;
  resourceLabel: string | null;
  resourceMeta?: AuditMeta;
}

type Db = typeof prisma | Prisma.TransactionClient;


export async function addAudit({ resourceMeta, ...attrs }: AuditAttrs, db: Db = prisma): Promise<void> {
    await db.auditLog.create({
      data: { ...attrs, resourceMeta: resourceMeta as unknown as Prisma.InputJsonValue }
    });
}