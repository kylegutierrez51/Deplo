// Run via `npx prisma db seed` (or automatically after `prisma migrate dev`).
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { encryptSecret } from "@/lib/utils/crypto";
import prisma from "@/lib/prisma";
import type { AuditMeta, EnvType } from "@/lib/types";
import {
  UserRole,
  EnvironmentType,
  EventType,
  AuditAction,
  ResourceType,
} from "../generated/prisma/client";

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.webhook.deleteMany();
  await prisma.stageResult.deleteMany();
  await prisma.pipelineRun.deleteMany();
  await prisma.pipelineDefinition.deleteMany();
  await prisma.secret.deleteMany();
  await prisma.environment.deleteMany();
  await prisma.pipeline.deleteMany();
  await prisma.user.deleteMany();

/*
===============================================================
  Users
===============================================================
*/
  const userSeeds = [
    { name: "kyle.g", email: "coco@acme.dev", role: UserRole.MEMBER },
  ];
  const users = await Promise.all(
    userSeeds.map((u) => prisma.user.create({ data: u }))
  );
  const userByName = new Map(users.map((u) => [u.name as string, u]));

/*
===============================================================
  Environments
===============================================================
*/
  const environmentSeeds = [
    { name: "dev", type: EnvironmentType.DEVELOPMENT, requireApproval: true, createdBy: "kyle.g" },
    { name: "staging", type: EnvironmentType.STAGING, requireApproval: false, createdBy: "kyle.g" },
    { name: "prod", type: EnvironmentType.PRODUCTION, requireApproval: false, createdBy: "kyle.g" },
    { name: "prev", type: EnvironmentType.PREVIEW, requireApproval: false, createdBy: "kyle.g" },
    { name: "custom", type: EnvironmentType.CUSTOM, requireApproval: false, createdBy: "kyle.g" },
    { name: "dev-2", type: EnvironmentType.DEVELOPMENT, requireApproval: false, createdBy: "kyle.g" },
    { name: "staging-2", type: EnvironmentType.STAGING, requireApproval: true, createdBy: "kyle.g" },
    { name: "prod-eu", type: EnvironmentType.PRODUCTION, requireApproval: true, createdBy: "kyle.g" },
    { name: "preview-pr", type: EnvironmentType.PREVIEW, requireApproval: false, createdBy: "kyle.g" },
    { name: "sandbox", type: EnvironmentType.CUSTOM, requireApproval: false, createdBy: "kyle.g" },
  ];
  const environments = await Promise.all(
    environmentSeeds.map((e) =>
      prisma.environment.create({
        data: {
          name: e.name,
          type: e.type,
          requireApproval: e.requireApproval,
          createdById: userByName.get(e.createdBy)?.id ?? null,
        },
      })
    )
  );
  const envByName = new Map(environments.map((e) => [e.name, e]));

/*
===============================================================
  Secrets
===============================================================
*/
  const secretSeeds = [
    { key: "DATABASE_URL", env: "prod", createdBy: "kyle.g",},
    { key: "DATABASE_URL", env: "staging", createdBy: null, },
    { key: "GITHUB_TOKEN", env: "dev", createdBy: "kyle.g", },
    { key: "GITHUB_TOKEN", env: "prev", createdBy: "kyle.g", },
    { key: "GITHUB_TOKEN", env: "custom", createdBy: null, },
    { key: "API_KEY", env: "dev-2", createdBy: "kyle.g", },
    { key: "STRIPE_KEY", env: "prod-eu", createdBy: null, notes: "stripe key production", },
    { key: "JWT_SECRET", env: "staging-2", createdBy: "kyle.g", notes: "staging notes" },
    { key: "SLACK_WEBHOOK", env: "preview-pr", createdBy: null, notes: "preview slack webhook notes" },
    { key: "NPM_TOKEN", env: "sandbox", createdBy: "kyle.g", notes: "sandbox key -- do whatever" },
  ];
  const secrets = await Promise.all(
    secretSeeds.map((s) => {
      const { encryptedValue, iv, authTag } = encryptSecret("asidaifaegauidfgaybaw2");
      return prisma.secret.create({
        data: {
          key: s.key,
          encryptedValue,
          iv,
          authTag,
          environmentId: envByName.get(s.env)!.id,
          createdById: s.createdBy ? userByName.get(s.createdBy)?.id ?? null : null,
        },
      });
    })
  );

/*
===============================================================
  1 Pipeline
===============================================================
*/
  const pipeline = await prisma.pipeline.create({
    data: {
      name: "verify-and-build",
      repoUrl: "https://github.com/abcd/deplo",
      description: "Type-checks and tests the app, then builds it behind an approval gate",
      createdById: userByName.get("kyle.g")?.id ?? null,
    },
  });

/*
===============================================================
  1 PipelineDefinition

  typecheck → approval → lint ───────────────┐
                                             ├→ approval → build
  unit-tests → integration-tests → e2e-tests ┘
===============================================================
*/
  type StageSeed = {
    id: string;
    name: string;
    type: "custom" | "deploy" | "approval";
    label?: string;
    x: number;
    y: number;
    command?: string;
    timeout?: number;
    retries?: number;
  };
  const stageSeeds: StageSeed[] = [
    { id: "stage-1", name: "typecheck", type: "custom", label: "tsc --noEmit", x: 0, y: 0, command: "npm run typecheck", timeout: 300, retries: 0 },
    { id: "stage-2", name: "typecheck-approval", type: "approval", label: "Approval", x: 0, y: 160 },
    { id: "stage-3", name: "lint", type: "custom", label: "eslint", x: 0, y: 320, command: "npm run lint", timeout: 300, retries: 0 },
    { id: "stage-4", name: "unit-tests", type: "custom", label: "jest", x: 360, y: 0, command: "npm test", timeout: 900, retries: 1 },
    { id: "stage-5", name: "integration-tests", type: "custom", label: "jest -c jest.config.integration.mjs", x: 360, y: 160, command: "npm run test:integration", timeout: 900, retries: 1 },
    { id: "stage-6", name: "e2e-tests", type: "custom", label: "playwright test", x: 360, y: 320, command: "npm run test:e2e", timeout: 1800, retries: 1 },
    { id: "stage-7", name: "release-approval", type: "approval", label: "Approval", x: 180, y: 480 },
    { id: "stage-8", name: "build", type: "deploy", label: "Deploy", x: 180, y: 640, command: "npm run build", timeout: 900, retries: 0 },
  ];
  const edgeSeeds: [source: string, target: string][] = [
    ["stage-1", "stage-2"],
    ["stage-2", "stage-3"],
    ["stage-4", "stage-5"],
    ["stage-5", "stage-6"],
    ["stage-3", "stage-7"],
    ["stage-6", "stage-7"],
    ["stage-7", "stage-8"],
  ];
  const graphJson = {
    nodes: stageSeeds.map((s) => ({
      id: s.id,
      position: { x: s.x, y: s.y },
      data: { type: s.type, name: s.name, ...(s.label !== undefined && { label: s.label }) },
    })),
    edges: edgeSeeds.map(([source, target], i) => ({ id: `edge-${i + 1}`, source, target })),
  };
  const configJson = Object.fromEntries(
    stageSeeds.map((s) => [
      s.id,
      {
        command: s.command ? ('cd /d "%PROJECT_DIR%" && ' + s.command) : null,
        timeout: s.timeout ?? null,
        retries: s.retries ?? null,
        env_vars: [],
        secrets: {},
      },
    ])
  );
  await prisma.pipelineDefinition.create({
    data: {
      pipelineId: pipeline.id,
      version: 1,
      graphJson,
      configJson,
      createdById: userByName.get("kyle.g")?.id ?? null,
    },
  });

/*
===============================================================
  Webhooks
===============================================================
*/
  const webhookSeeds = [
    { isActive: true, events: [EventType.PUSH, EventType.PULL_REQUEST], branchFilters: ["main", "release/*", "hotfix/*"], createdBy: "kyle.g" },
  ];
  await Promise.all(
    webhookSeeds.map((w) => {
      const { encryptedValue, iv, authTag } = encryptSecret(randomBytes(20).toString("hex"));
      return prisma.webhook.create({
        data: {
          isActive: w.isActive,
          events: w.events,
          branchFilters: w.branchFilters,
          lastDelivery: new Date(),
          encryptedValue,
          iv,
          authTag,
          pipelineId: pipeline.id,
          createdById: w.createdBy ? userByName.get(w.createdBy)?.id ?? null : null,
        },
      });
    })
  );

/*
===============================================================
  Audit Log
===============================================================
*/
  const auditSeeds: { action: AuditAction; resourceType: ResourceType; resourceId: string; resourceLabel: string; resourceMeta?: AuditMeta; user: string | null; actor?: string }[] = [
    { action: AuditAction.PIPELINE_CREATED, resourceType: ResourceType.PIPELINE, resourceId: pipeline.id, resourceLabel: "verify-and-build", user: "kyle.g" },
    { action: AuditAction.WEBHOOK_RECEIVED, resourceType: ResourceType.WEBHOOK, resourceId: pipeline.id, resourceLabel: "push → abcd/deplo", user: null, actor: "github" },
    {
      action: AuditAction.SECRET_CREATED, resourceType: ResourceType.SECRET, resourceId: secrets[0].id, resourceLabel: "DATABASE_URL (production)", user: "kyle.g",
      resourceMeta: { kind: 'secret', key: 'DATABASE_URL', type: envByName.get("prod")!.type.toLowerCase() as EnvType },
    },
    {
      action: AuditAction.SECRET_CREATED, resourceType: ResourceType.SECRET, resourceId: secrets[2].id, resourceLabel: "GITHUB_TOKEN (development)", user: "kyle.g",
      resourceMeta: { kind: 'secret', key: 'GITHUB_TOKEN', type: envByName.get("dev")!.type.toLowerCase() as EnvType },
    },
    {
      action: AuditAction.ENVIRONMENT_CREATED, resourceType: ResourceType.ENVIRONMENT, resourceId: envByName.get("sandbox")!.id, resourceLabel: "sandbox", user: "kyle.g",
      resourceMeta: { kind: 'environment', name: 'sandbox', type: envByName.get("sandbox")!.type.toLowerCase() as EnvType },
    },
  ];
  await Promise.all(
    auditSeeds.map((a) =>
      prisma.auditLog.create({
        data: {
          action: a.action,
          resourceType: a.resourceType,
          resourceId: a.resourceId,
          resourceLabel: a.resourceLabel,
          resourceMeta: a.resourceMeta,
          userId: a.user ? userByName.get(a.user)?.id ?? null : null,
          actor: a.actor ?? null,
        },
      })
    )
  );

  console.log(`Seeded ${users.length} users, ${environments.length} environments, ${secrets.length} secrets, 1 pipeline (${stageSeeds.length} stages), 1 pipeline definition, 1 queued run, ${webhookSeeds.length} webhooks, ${auditSeeds.length} audit logs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
