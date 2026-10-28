import { render, screen } from '@testing-library/react';
import WebhookCard from '@/components/webhooks/WebhookCard';
import type { Webhook } from '@/lib/data/webhooks';

const webhook = (over: Partial<Webhook> = {}) => ({
  id: 'wh-1',
  pipelineId: 'p1',
  pipelineName: 'deploy-api',
  pipelineRepoUrl: 'https://github.com/org/repo',
  isActive: true,
  events: ['push'],
  branchFilters: [],
  lastDelivery: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
}) as Webhook;

const warning = () => screen.queryByText(/won't check out the pushed code/);

describe('the repo URL warning', () => {
  it('is absent when the pipeline has a usable Repo URL', () => {
    render(<WebhookCard webhook={webhook()} />);
    expect(warning()).not.toBeInTheDocument();
  });

  it('shows when the pipeline has no Repo URL', () => {
    render(<WebhookCard webhook={webhook({ pipelineRepoUrl: null })} />);
    expect(warning()).toHaveTextContent("deploy-api has no usable Repo URL, so webhook runs won't check out the pushed code.");
  });

  it('shows when the pipeline has a Repo URL Deplo cannot use', () => {
    render(<WebhookCard webhook={webhook({ pipelineRepoUrl: 'https://user:tok@github.com/org/repo' })} />);
    expect(warning()).toHaveTextContent("deploy-api has no usable Repo URL");
  });

  // The card already says "Pipeline Not Found"; a repo warning on top would be noise.
  it('is absent when the pipeline no longer exists', () => {
    render(<WebhookCard webhook={webhook({ pipelineId: null, pipelineName: null, pipelineRepoUrl: null })} />);
    expect(warning()).not.toBeInTheDocument();
  });
});
