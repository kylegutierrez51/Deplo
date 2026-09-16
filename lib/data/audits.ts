import prisma from "@/lib/prisma";
import type { AuditAction as PrismaAuditAction, ResourceType as PrismaResourceType, AuditLog as PrismaAuditLog } from "@/generated/prisma";
import type { AuditAction, AuditMeta, ResourceType } from "@/lib/types";

export type Audit = Omit<PrismaAuditLog, "action" | "resourceType" | "resourceMeta"> & {
  action: AuditAction;
  resourceType: ResourceType;
  resourceMeta: AuditMeta | null;
  user: string | null;
}

const ACTION_MAP: Record<PrismaAuditAction, AuditAction> = {
  PIPELINE_CREATED: "Pipeline Created",
  PIPELINE_UPDATED: "Pipeline Updated",
  PIPELINE_DELETED: "Pipeline Deleted",
  PIPELINE_DEFINITION_UPDATED: "Pipeline Definition Updated",
  SECRET_CREATED: "Secret Created",
  SECRET_UPDATED: "Secret Updated",
  SECRET_DELETED: "Secret Deleted",
  ENVIRONMENT_CREATED: "Environment Created",
  ENVIRONMENT_UPDATED: "Environment Updated",
  ENVIRONMENT_DELETED: "Environment Deleted",
  WEBHOOK_RECEIVED: "Webhook Received",
  WEBHOOK_CREATED: "Webhook Created",
  WEBHOOK_UPDATED: "Webhook Updated",
  WEBHOOK_DELETED: "Webhook Deleted",
  RUN_TRIGGERED: "Run Triggered",
  RUN_COMPLETED: "Run Completed",
  RUN_CANCELLED: "Run Cancelled",
  APPROVAL_GRANTED: "Approval Granted",
  APPROVAL_REJECTED: "Approval Rejected",
  USER_ROLE_CHANGED: "User Role Changed",
};

const RESOURCE_MAP: Record<PrismaResourceType, ResourceType> = {
  PIPELINE: "pipeline",
  PIPELINE_RUN: "pipeline-run",
  ENVIRONMENT: "environment",
  SECRET: "secret",
  WEBHOOK: "webhook",
};

function parseAuditMeta(value: unknown): AuditMeta | null {
  if (typeof value !== 'object' || value === null || !('kind' in value)) return null;
  return value as AuditMeta;
}

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
    resourceMeta: parseAuditMeta(audit.resourceMeta),
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
    resourceMeta: parseAuditMeta(audit.resourceMeta),
    user: audit.user?.name ?? null
  }
}