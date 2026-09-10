import prisma from "@/lib/prisma";
import { AuditAction, ResourceType } from "@/generated/prisma";

interface AuditAttrs {
  userId?: string;
  actor?: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId: string;
  resourceLabel?: string;
}


export async function addAudit({ userId, actor, action, resourceType, resourceId, resourceLabel }: AuditAttrs): Promise<boolean> {
  try {
    await prisma.auditLog.create({
      data: {
        userId, actor, action, resourceType, resourceId, resourceLabel
      },
    });

    return true;

  } catch (error: unknown) {
    console.log(error instanceof Error ? error.message : '');
    return false;
  }
}