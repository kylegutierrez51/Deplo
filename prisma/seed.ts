// Seeds the database with data shaped after the mock arrays in lib/data/*.
// Run via `npx prisma db seed` (or automatically after `prisma migrate dev`).
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { encryptSecret } from "@/lib/crypto";
import prisma from "@/lib/prisma";
import {
  UserRole,
  EnvironmentType,
  RunStatus,
  RunTrigger,
  StageStatus,
  StageType,
  WebhookEventStatus,
  AuditAction,
  ResourceType
} from "../generated/prisma/client";

async function main() {
  // Clear in reverse dependency order so re-running the seed is idempotent.
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

  // ── Users ──────────────────────────────────────────────────────
  // Names pulled from createdBy/triggeredBy/actor fields across lib/data/*.
  const userSeeds = [
    { name: "coco", email: "coco@acme.dev", role: UserRole.MEMBER },
    { name: "sarah.chen", email: "sarah.chen@acme.dev", role: UserRole.MEMBER },
    { name: "marcus.coco", email: "marcus.coco@acme.dev", role: UserRole.MEMBER },
    { name: "diego.ramirez", email: "diego.ramirez@acme.dev", role: UserRole.MEMBER },
    { name: "priya.nair", email: "priya.nair@acme.dev", role: UserRole.MEMBER },
    { name: "jordan.lee", email: "jordan.lee@acme.dev", role: UserRole.MEMBER },
    { name: "amara.okafor", email: "amara.okafor@acme.dev", role: UserRole.MEMBER },
    { name: "felix.mueller", email: "felix.mueller@acme.dev", role: UserRole.MEMBER },
    { name: "yuki.tanaka", email: "yuki.tanaka@acme.dev", role: UserRole.MEMBER },
    { name: "olivia.brooks", email: "olivia.brooks@acme.dev", role: UserRole.MEMBER },
  ];
  const users = await Promise.all(
    userSeeds.map((u) => prisma.user.create({ data: u }))
  );
  const userByName = new Map(users.map((u) => [u.name as string, u]));

  // ── Environments ───────────────────────────────────────────────
  // Base 5 from lib/data/environments.ts, plus a few extra of the same
  // shape so each EnvironmentType has more than one row.
  const environmentSeeds = [
    { name: "dev", type: EnvironmentType.DEVELOPMENT, requireApproval: true, createdBy: "coco" },
    { name: "staging", type: EnvironmentType.STAGING, requireApproval: false, createdBy: "coco" },
    { name: "prod", type: EnvironmentType.PRODUCTION, requireApproval: false, createdBy: "coco" },
    { name: "prev", type: EnvironmentType.PREVIEW, requireApproval: false, createdBy: "coco" },
    { name: "custom", type: EnvironmentType.CUSTOM, requireApproval: false, createdBy: "coco" },
    { name: "dev-2", type: EnvironmentType.DEVELOPMENT, requireApproval: false, createdBy: "marcus.coco" },
    { name: "staging-2", type: EnvironmentType.STAGING, requireApproval: true, createdBy: "sarah.chen" },
    { name: "prod-eu", type: EnvironmentType.PRODUCTION, requireApproval: true, createdBy: "sarah.chen" },
    { name: "preview-pr", type: EnvironmentType.PREVIEW, requireApproval: false, createdBy: "diego.ramirez" },
    { name: "sandbox", type: EnvironmentType.CUSTOM, requireApproval: false, createdBy: "priya.nair" },
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

  // ── Secrets ─────────────────────────────────────────────────────
  // From lib/data/secrets.ts, extended with a few more common CI/CD keys.
  const secretSeeds = [
    { key: "DATABASE_URL", env: "prod", createdBy: "sarah.chen" },
    { key: "DATABASE_URL", env: "staging", createdBy: "sarah.chen" },
    { key: "GITHUB_TOKEN", env: "dev", createdBy: "marcus.coco" },
    { key: "GITHUB_TOKEN", env: "prev", createdBy: "marcus.coco" },
    { key: "GITHUB_TOKEN", env: "custom", createdBy: null },
    { key: "API_KEY", env: "dev-2", createdBy: "marcus.coco" },
    { key: "STRIPE_KEY", env: "prod-eu", createdBy: "sarah.chen", notes: "stripe key production", },
    { key: "JWT_SECRET", env: "staging-2", createdBy: "sarah.chen", notes: "staging notes" },
    { key: "SLACK_WEBHOOK", env: "preview-pr", createdBy: "diego.ramirez", notes: "preview slack webhook notes" },
    { key: "NPM_TOKEN", env: "sandbox", createdBy: "priya.nair", notes: "sandbox key -- do whatever" },
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

  // ── Pipelines ───────────────────────────────────────────────────
  // Unique pipeline names referenced across lib/data/pipelines.ts,
  // lib/data/webhooks.ts and lib/data/webhook-events.ts.
  const pipelineSeeds = [
    { name: "build-frontend", repoUrl: "https://github.com/abcd/web-client", description: "Builds and deploys the web client on every push to main", branchFilters: ["main", "release/*", "hotfix/*"], createdBy: "coco" },
    { name: "deploy-api", repoUrl: "https://github.com/abcd/api-server", description: "Builds and deploys the API server", branchFilters: ["main"], createdBy: "coco" },
    { name: "release-mobile", repoUrl: "https://github.com/abcd/mobile-app", description: "Builds and ships the mobile app to app stores", branchFilters: ["main", "release/*"], createdBy: "coco" },
    { name: "deploy-infra", repoUrl: "https://github.com/abcd/infra", description: "Applies Terraform changes to cloud infrastructure", branchFilters: ["main/*", "release/*", "hotfix/*"], createdBy: "coco" },
    { name: "db-migrate", repoUrl: "https://github.com/abcd/web-client", description: "Runs database migrations for the RBAC system", branchFilters: ["main"], createdBy: "marcus.coco" },
    { name: "deploy-worker", repoUrl: "https://github.com/abcd/worker-service", description: "Builds and deploys the background worker service", branchFilters: ["main"], createdBy: "diego.ramirez" },
    { name: "run-e2e-tests", repoUrl: "https://github.com/abcd/web-client", description: "Runs the end-to-end test suite against staging", branchFilters: ["main", "staging/*"], createdBy: "priya.nair" },
    { name: "deploy-docs", repoUrl: "https://github.com/abcd/docs-site", description: "Publishes the public documentation site", branchFilters: ["main"], createdBy: "jordan.lee" },
    { name: "sync-translations", repoUrl: "https://github.com/abcd/web-client", description: "Syncs translation files from the localization provider", branchFilters: ["main"], createdBy: "amara.okafor" },
    { name: "backup-prod-db", repoUrl: "https://github.com/abcd/infra", description: "Nightly backup of the production database", branchFilters: ["main"], createdBy: "felix.mueller" },
  ];
  const pipelines = await Promise.all(
    pipelineSeeds.map((p) =>
      prisma.pipeline.create({
        data: {
          name: p.name,
          repoUrl: p.repoUrl,
          description: p.description,
          branchFilters: p.branchFilters,
          createdById: userByName.get(p.createdBy)?.id ?? null,
        },
      })
    )
  );
  const pipelineByName = new Map(pipelines.map((p) => [p.name, p]));

  // ── Pipeline Definitions ────────────────────────────────────────
  // graphJson mirrors the React Flow shape implied by lib/data/run-detail.ts;
  // configJson is a per-stage command/timeout/retry map.
  function buildDefinition(stageNames: string[]) {
    const nodes = stageNames.map((name, i) => ({ id: `stage-${i + 1}`, type: "stage", data: { label: name }, position: { x: 0, y: i * 120 } }));
    const edges = stageNames.slice(1).map((_, i) => ({ id: `edge-${i + 1}`, source: `stage-${i + 1}`, target: `stage-${i + 2}` }));
    const configJson = Object.fromEntries(
      stageNames.map((name, i) => [`stage-${i + 1}`, { command: `run ${name}`, timeoutSeconds: 600, retries: 0 }])
    );
    return { graphJson: { nodes, edges }, configJson };
  }
  const definitionSeeds: { pipeline: string; version: number; stages: string[]; createdBy: string }[] = [
    { pipeline: "build-frontend", version: 1, stages: ["install-deps", "lint", "unit-tests", "build", "deploy-staging", "smoke-tests", "manual-approval", "deploy-production"], createdBy: "coco" },
    { pipeline: "deploy-api", version: 1, stages: ["install-deps", "build", "deploy-staging", "manual-approval"], createdBy: "coco" },
    { pipeline: "deploy-api", version: 2, stages: ["install-deps", "lint", "unit-tests", "build", "deploy-staging", "smoke-tests", "manual-approval", "deploy-production"], createdBy: "sarah.chen" },
    { pipeline: "release-mobile", version: 1, stages: ["install-deps", "lint", "unit-tests", "release-approval", "db-backup", "publish-stores"], createdBy: "coco" },
    { pipeline: "deploy-infra", version: 1, stages: ["install-deps", "lint", "unit-tests", "release-approval", "db-backup", "publish-stores"], createdBy: "coco" },
    { pipeline: "db-migrate", version: 1, stages: ["install-deps", "run-migration", "manual-approval"], createdBy: "marcus.coco" },
    { pipeline: "deploy-worker", version: 1, stages: ["install-deps", "build", "deploy-staging", "deploy-production"], createdBy: "diego.ramirez" },
    { pipeline: "run-e2e-tests", version: 1, stages: ["install-deps", "build", "e2e-tests"], createdBy: "priya.nair" },
    { pipeline: "deploy-docs", version: 1, stages: ["install-deps", "build", "deploy-production"], createdBy: "jordan.lee" },
    { pipeline: "sync-translations", version: 1, stages: ["install-deps", "fetch-translations", "open-pr"], createdBy: "amara.okafor" },
  ];
  const definitions = await Promise.all(
    definitionSeeds.map((d) => {
      const { graphJson, configJson } = buildDefinition(d.stages);
      return prisma.pipelineDefinition.create({
        data: {
          pipelineId: pipelineByName.get(d.pipeline)!.id,
          version: d.version,
          graphJson,
          configJson,
          createdById: userByName.get(d.createdBy)?.id ?? null,
        },
      });
    })
  );
  // Latest definition per pipeline, used as the default for new runs.
  const latestDefinitionByPipeline = new Map<string, (typeof definitions)[number]>();
  definitionSeeds.forEach((d, i) => {
    const existing = latestDefinitionByPipeline.get(d.pipeline);
    if (!existing || d.version > existing.version) {
      latestDefinitionByPipeline.set(d.pipeline, definitions[i]);
    }
  });

  // ── Pipeline Runs ────────────────────────────────────────────────
  // From lib/data/runs.ts and lib/data/run-detail.ts, plus the three runs
  // referenced by lib/data/approvals.ts (awaiting manual approval).
  const runSeeds = [
    { pipeline: "deploy-api", status: RunStatus.QUEUED, trigger: RunTrigger.WEBHOOK, env: "prod", branch: "main", commitSha: "a1b2c3d", triggeredBy: "sarah.chen" },
    { pipeline: "build-frontend", status: RunStatus.RUNNING, trigger: RunTrigger.MANUAL, env: "staging", branch: "main", commitSha: "f4e5d6c", triggeredBy: "coco" },
    { pipeline: "deploy-api", status: RunStatus.SUCCESS, trigger: RunTrigger.API, env: "dev", branch: "main", commitSha: "a1b2c3d", triggeredBy: "sarah.chen" },
    { pipeline: "deploy-api", status: RunStatus.FAILED, trigger: RunTrigger.WEBHOOK, env: "prev", branch: "main", commitSha: "7890abc", triggeredBy: "sarah.chen" },
    { pipeline: "deploy-api", status: RunStatus.CANCELLED, trigger: RunTrigger.MANUAL, env: "custom", branch: "main", commitSha: "7890abc", triggeredBy: "marcus.coco" },
    { pipeline: "release-mobile", status: RunStatus.FAILED, trigger: RunTrigger.WEBHOOK, env: "prod", branch: "main", commitSha: "7890abc", triggeredBy: "coco" },
    { pipeline: "release-mobile", status: RunStatus.QUEUED, trigger: RunTrigger.MANUAL, env: "staging", branch: "main", commitSha: "7890abc", triggeredBy: "coco" },
    { pipeline: "deploy-infra", status: RunStatus.RUNNING, trigger: RunTrigger.MANUAL, env: "prod-eu", branch: "main", commitSha: "c3d435f", triggeredBy: "coco" },
    { pipeline: "deploy-infra", status: RunStatus.RUNNING, trigger: RunTrigger.MANUAL, env: "prod-eu", branch: "main", commitSha: "c3d435f", triggeredBy: "diego.ramirez" },
    { pipeline: "db-migrate", status: RunStatus.SUCCESS, trigger: RunTrigger.WEBHOOK, env: "dev-2", branch: "feature/auth-flow", commitSha: "7890abc", triggeredBy: "marcus.coco" },
  ];
  const runs = await Promise.all(
    runSeeds.map((r) =>
      prisma.pipelineRun.create({
        data: {
          pipelineId: pipelineByName.get(r.pipeline)!.id,
          definitionId: latestDefinitionByPipeline.get(r.pipeline)!.id,
          status: r.status,
          trigger: r.trigger,
          commitSha: r.commitSha,
          branch: r.branch,
          environmentId: envByName.get(r.env)!.id,
          triggeredById: userByName.get(r.triggeredBy)?.id ?? null,
          startedAt: new Date(),
          finishedAt: ([RunStatus.SUCCESS, RunStatus.FAILED, RunStatus.CANCELLED] as RunStatus[]).includes(r.status) ? new Date() : null,
        },
      })
    )
  );

  // ── Stage Results ────────────────────────────────────────────────
  // Stage shapes come from lib/data/run-detail.ts (graph nodes) and
  // lib/data/approvals.ts (approval-gated stage lists).
  const stageSeeds: { run: number; stageId: string; stageName: string; stageType: StageType; status: StageStatus; approvedBy?: string }[] = [
    { run: 0, stageId: "stage-1", stageName: "install-deps", stageType: StageType.BUILD, status: StageStatus.SUCCESS },
    { run: 0, stageId: "stage-2", stageName: "deploy-staging", stageType: StageType.DEPLOY, status: StageStatus.QUEUED },
    { run: 1, stageId: "stage-1", stageName: "install-deps", stageType: StageType.BUILD, status: StageStatus.SUCCESS },
    { run: 1, stageId: "stage-2", stageName: "lint", stageType: StageType.BUILD, status: StageStatus.SUCCESS },
    { run: 1, stageId: "stage-3", stageName: "unit-tests", stageType: StageType.TEST, status: StageStatus.SUCCESS },
    { run: 1, stageId: "stage-4", stageName: "build", stageType: StageType.BUILD, status: StageStatus.SUCCESS },
    { run: 1, stageId: "stage-5", stageName: "deploy-staging", stageType: StageType.DEPLOY, status: StageStatus.RUNNING },
    { run: 3, stageId: "stage-1", stageName: "install-deps", stageType: StageType.BUILD, status: StageStatus.SUCCESS },
    { run: 3, stageId: "stage-2", stageName: "build", stageType: StageType.BUILD, status: StageStatus.SUCCESS },
    { run: 3, stageId: "stage-3", stageName: "deploy-staging", stageType: StageType.DEPLOY, status: StageStatus.FAILED },
    { run: 5, stageId: "stage-1", stageName: "install-deps", stageType: StageType.BUILD, status: StageStatus.SUCCESS },
    { run: 5, stageId: "stage-2", stageName: "lint", stageType: StageType.BUILD, status: StageStatus.SUCCESS },
    { run: 5, stageId: "stage-3", stageName: "unit-tests", stageType: StageType.TEST, status: StageStatus.SUCCESS },
    { run: 5, stageId: "stage-4", stageName: "release-approval", stageType: StageType.APPROVAL, status: StageStatus.AWAITING_APPROVAL },
    { run: 5, stageId: "stage-5", stageName: "db-backup", stageType: StageType.SCRIPT, status: StageStatus.QUEUED },
    { run: 5, stageId: "stage-6", stageName: "publish-stores", stageType: StageType.DEPLOY, status: StageStatus.QUEUED },
    { run: 6, stageId: "stage-1", stageName: "install-deps", stageType: StageType.BUILD, status: StageStatus.SUCCESS },
    { run: 6, stageId: "stage-2", stageName: "release-approval", stageType: StageType.APPROVAL, status: StageStatus.AWAITING_APPROVAL },
    { run: 7, stageId: "stage-1", stageName: "release-approval", stageType: StageType.APPROVAL, status: StageStatus.APPROVED, approvedBy: "coco" },
  ];
  const stageResults = await Promise.all(
    stageSeeds.map((s) =>
      prisma.stageResult.create({
        data: {
          runId: runs[s.run].id,
          stageId: s.stageId,
          stageName: s.stageName,
          stageType: s.stageType,
          status: s.status,
          approvedById: s.approvedBy ? userByName.get(s.approvedBy)?.id ?? null : null,
          approvedAt: s.approvedBy ? new Date() : null,
        },
      })
    )
  );

  // ── Webhooks ─────────────────────────────────────────────────────
  // From lib/data/webhooks.ts, extended with a couple more repos.
  const webhookSeeds = [
    { repo: "abcd/infra", pipeline: "deploy-infra", isActive: true, events: ["push", "pull_request"], branchFilters: ["main/*", "release/*", "hotfix/*"], createdBy: "coco" },
    { repo: "abcd/infra", pipeline: "deploy-infra", isActive: false, events: ["push"], branchFilters: [], createdBy: null },
    { repo: "abcd/api-server", pipeline: "deploy-api", isActive: false, events: ["pull_request"], branchFilters: [], createdBy: null },
    { repo: "abcd/web-client", pipeline: "build-frontend", isActive: true, events: ["push"], branchFilters: ["main", "release/*"], createdBy: "sarah.chen" },
    { repo: "abcd/web-client", pipeline: "db-migrate", isActive: true, events: ["push", "pull_request"], branchFilters: ["main"], createdBy: "marcus.coco" },
    { repo: "abcd/mobile-app", pipeline: "release-mobile", isActive: true, events: ["push"], branchFilters: ["main", "release/*"], createdBy: "coco" },
    { repo: "abcd/worker-service", pipeline: "deploy-worker", isActive: true, events: ["push"], branchFilters: ["main"], createdBy: "diego.ramirez" },
    { repo: "abcd/web-client", pipeline: "run-e2e-tests", isActive: false, events: ["pull_request"], branchFilters: ["main"], createdBy: "priya.nair" },
    { repo: "abcd/docs-site", pipeline: "deploy-docs", isActive: true, events: ["push"], branchFilters: ["main"], createdBy: "jordan.lee" },
    { repo: "abcd/web-client", pipeline: "sync-translations", isActive: false, events: ["push"], branchFilters: ["main"], createdBy: "amara.okafor" },
  ];
  await Promise.all(
    webhookSeeds.map((w) => {
      const { encryptedValue, iv, authTag } = encryptSecret(randomBytes(20).toString("hex"));
      return prisma.webhook.create({
        data: {
          repo: w.repo,
          isActive: w.isActive,
          events: w.events,
          branchFilters: w.branchFilters,
          lastDelivery: new Date().toISOString(),
          registeredAgo: new Date().toISOString(),
          encryptedValue,
          iv,
          authTag,
          createdById: w.createdBy ? userByName.get(w.createdBy)?.id ?? null : null,
        },
      });
    })
  );

  // ── Webhook Events ───────────────────────────────────────────────
  // From lib/data/webhook-events.ts, extended with a few more deliveries.
  const webhookEventSeeds = [
    { pipeline: "deploy-api", eventType: "pull_request", status: WebhookEventStatus.PENDING, branch: "main", commitSha: "a1b2c3d", commitMessage: "feat: add retry logic to webhook delivery handler" },
    { pipeline: "deploy-api", eventType: "push", status: WebhookEventStatus.PROCESSED, branch: "main", commitSha: "a1b2c3d", commitMessage: "feat: add retry logic to webhook delivery handler" },
    { pipeline: "build-frontend", eventType: "push", status: WebhookEventStatus.IGNORED, branch: "release/v2.4.0", commitSha: "f4e5d6c", commitMessage: "chore: bump dependencies to latest stable versions" },
    { pipeline: "db-migrate", eventType: "pull_request", status: WebhookEventStatus.FAILED, branch: "feature/auth-flow", commitSha: "7890abc", commitMessage: "feat: add user role migration for RBAC system" },
    { pipeline: "release-mobile", eventType: "push", status: WebhookEventStatus.PROCESSED, branch: "release/v3.1.0", commitSha: "c3d435f", commitMessage: "fix: resolve deep link crash on Android 14" },
    { pipeline: "deploy-infra", eventType: "push", status: WebhookEventStatus.PROCESSED, branch: "main", commitSha: "c3d435f", commitMessage: "fix: resolve deep link crash on Android 14" },
    { pipeline: "deploy-worker", eventType: "push", status: WebhookEventStatus.PENDING, branch: "main", commitSha: "d4e5f6a", commitMessage: "feat: add dead-letter queue for failed jobs" },
    { pipeline: "run-e2e-tests", eventType: "pull_request", status: WebhookEventStatus.IGNORED, branch: "feature/checkout-flow", commitSha: "e5f6a1b", commitMessage: "test: add checkout flow e2e coverage" },
    { pipeline: "deploy-docs", eventType: "push", status: WebhookEventStatus.PROCESSED, branch: "main", commitSha: "f6a1b2c", commitMessage: "docs: update API reference for v2 endpoints" },
    { pipeline: "sync-translations", eventType: "push", status: WebhookEventStatus.FAILED, branch: "main", commitSha: "a1b2c3e", commitMessage: "chore: sync translations from Crowdin" },
  ];
  await Promise.all(
    webhookEventSeeds.map((e) => {
      const pipeline = pipelineByName.get(e.pipeline)!;
      return prisma.webhookEvent.create({
        data: {
          pipelineId: pipeline.id,
          eventType: e.eventType,
          source: "github",
          payload: { ref: `refs/heads/${e.branch}`, after: e.commitSha, head_commit: { message: e.commitMessage } },
          headers: { "X-GitHub-Event": e.eventType, "X-GitHub-Delivery": randomBytes(8).toString("hex") },
          status: e.status,
        },
      });
    })
  );

  // ── Audit Log ────────────────────────────────────────────────────
  // From lib/data/audits.ts, extended with a few more action types.
  const auditSeeds: { action: AuditAction; resourceType: ResourceType; resourceId: string; user: string | null }[] = [
    { action: AuditAction.RUN_COMPLETED, resourceType: ResourceType.PIPELINE_RUN, resourceId: runs[2].id, user: null },
    { action: AuditAction.PIPELINE_TRIGGERED, resourceType: ResourceType.PIPELINE_RUN, resourceId: runs[2].id, user: null },
    { action: AuditAction.WEBHOOK_RECEIVED, resourceType: ResourceType.PIPELINE, resourceId: pipelineByName.get("deploy-api")!.id, user: null },
    { action: AuditAction.PIPELINE_CREATED, resourceType: ResourceType.PIPELINE, resourceId: pipelineByName.get("build-frontend")!.id, user: "coco" },
    { action: AuditAction.SECRET_CREATED, resourceType: ResourceType.SECRET, resourceId: secrets[0].id, user: "sarah.chen" },
    { action: AuditAction.APPROVAL_GRANTED, resourceType: ResourceType.STAGE_RESULT, resourceId: stageResults[18].id, user: "coco" },
    { action: AuditAction.RUN_CANCELLED, resourceType: ResourceType.PIPELINE_RUN, resourceId: runs[4].id, user: "marcus.coco" },
    { action: AuditAction.ENVIRONMENT_CREATED, resourceType: ResourceType.ENVIRONMENT, resourceId: envByName.get("sandbox")!.id, user: "priya.nair" },
    { action: AuditAction.SECRET_CREATED, resourceType: ResourceType.SECRET, resourceId: secrets[1].id, user: "coco" },
    { action: AuditAction.PIPELINE_DELETED, resourceType: ResourceType.PIPELINE, resourceId: pipelineByName.get("sync-translations")!.id, user: "amara.okafor" },
  ];
  await Promise.all(
    auditSeeds.map((a) =>
      prisma.auditLog.create({
        data: {
          action: a.action,
          resourceType: a.resourceType,
          resourceId: a.resourceId,
          userId: a.user ? userByName.get(a.user)?.id ?? null : null,
        },
      })
    )
  );

  console.log(`Seeded ${users.length} users, ${environments.length} environments, ${pipelines.length} pipelines, ${definitions.length} pipeline definitions, ${runs.length} runs, ${stageSeeds.length} stage results, ${webhookSeeds.length} webhooks, ${webhookEventSeeds.length} webhook events, ${auditSeeds.length} audit logs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
