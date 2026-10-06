import { NextRequest, NextResponse } from "next/server";
import { getWebhookById } from "@/lib/data/webhooks";
import { decryptSecret, verifyWebhookSignature } from "@/lib/utils/crypto";
import { addWebhookEvent, updateWebhookEvent } from "@/lib/webhooks/webhook-events";
import { WebhookEventData } from "@/lib/types";
import { checkBranches } from '@/lib/webhooks/branches';


export async function POST(req: NextRequest, ctx: RouteContext<'/api/webhook/[id]'>) {
  const { id } = await ctx.params;

  const webhook = await getWebhookById(id);
  if (!webhook || !webhook.isActive) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  const text = await req.text(); // reads raw body — the signature covers these exact bytes

  const secret = decryptSecret(webhook);
  if (!verifyWebhookSignature(secret, text, req.headers.get("x-hub-signature-256"))) {
    console.log('error!');
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(text);

  const headers = {
    event: req.headers.get('x-github-event'),
    delivery: req.headers.get('x-github-delivery'),
  };

  const githubEvent = req.headers.get('x-github-event');

  const eventType = githubEvent === 'push' ? 'push' :
                    githubEvent === 'pull_request' ? 'pull-request' :
                    githubEvent === 'ping' ? 'ping' :
                    'unrecognized';

  const eventData: WebhookEventData = { eventType, payload, headers, webhookId: webhook.id, pipelineId: webhook.pipelineId };

  const { webhookEventId, ..._rest } = await addWebhookEvent(eventData);

  if (!webhookEventId) return; // TODO: error


  if (githubEvent === 'ping') {
    console.log('GitHub sent the ping event');
    updateWebhookEvent(webhookEventId, 'processed');
    return NextResponse.json({ status: 200 });
  }
  else if (githubEvent === 'push' || githubEvent === 'pull_request') {

    // check for branch filters
    const target = githubEvent == 'push' ? payload.ref.replace('refs/heads/', '') : payload.pull_request.base.ref.replace('refs/heads/', '');
    console.log('targeted branch: ' + target);

    if (!checkBranches(target, webhook.branchFilters)) {
      updateWebhookEvent(webhookEventId, 'ignored');

      return NextResponse.json({ status: 200, message: `The target: (${target}) did not match the branch filters: (${webhook.branchFilters})`});
    }

    







  }
  else {
    console.log(`Unhandled event: ${githubEvent}`)
    updateWebhookEvent(webhookEventId, 'ignored');
  }

  return NextResponse.json({ ok: true });
}
