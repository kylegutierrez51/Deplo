import prisma from "@/lib/prisma";
import type { AuditAction as PrismaAuditAction, ResourceType as PrismaResourceType, AuditLog as PrismaAuditLog } from "@/generated/prisma";
import type { AuditAction, ResourceType } from "@/lib/types";

export type Audit = Omit<PrismaAuditLog, "action" | "resourceType"> & {
  action: AuditAction;
  resourceType: ResourceType;
  user: string | null;
}
const ACTION_MAP: Record<PrismaAuditAction, AuditAction> = {
  PIPELINE_CREATED: "Pipeline Created",
  PIPELINE_UPDATED: "Pipeline Updated",
  PIPELINE_DELETED: "Pipeline Deleted",
  PIPELINE_TRIGGERED: "Pipeline Triggered",
  SECRET_CREATED: "Secret Created",
  SECRET_UPDATED: "Secret Updated",
  SECRET_DELETED: "Secret Deleted",
  APPROVAL_GRANTED: "Approval Granted",
  APPROVAL_REJECTED: "Approval Rejected",
  RUN_COMPLETED: "Run Completed",
  RUN_CANCELLED: "Run Cancelled",
  WEBHOOK_RECEIVED: "Webhook Received",
  ENVIRONMENT_CREATED: "Environment Created",
  ENVIRONMENT_DELETED: "Environment Deleted",
  USER_ROLE_CHANGED: "User Role Changed"
};

const RESOURCE_MAP: Record<PrismaResourceType, ResourceType> = {
  PIPELINE: "Pipeline",
  PIPELINE_RUN: "PipelineRun",
  APPROVAL: "Approval",
  ENVIRONMENT: "Environment",
  SECRET: "Secret",
  WEBHOOK: "Webhook",
  STAGE_RESULT: "Stage Result",
  SETTING: "Setting",
};

export async function getAudits(): Promise<Audit[]> {
  const audits = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true }}
    }
  });

  return audits.map(({ ...audit }) => ({
    ...audit,
    action: ACTION_MAP[audit.action],
    resourceType: RESOURCE_MAP[audit.resourceType],
    user: audit.user?.name ?? null
  }));
}

export async function getAuditById(id: string): Promise<Audit | null> {
  const audit = await prisma.auditLog.findUnique({
    where: { id },
    include: {
      user: { select: { name: true }}
    }
  });

  if (!audit) return null;

  return {
    ...audit,
    action: ACTION_MAP[audit.action],
    resourceType: RESOURCE_MAP[audit.resourceType],
    user: audit.user?.name ?? null
  }
}