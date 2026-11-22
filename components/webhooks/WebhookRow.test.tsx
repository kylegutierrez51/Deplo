import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WebhookRow from '@/components/webhooks/WebhookRow';
import type { Webhook } from '@/lib/data/webhooks';

const mockPush = jest.fn();
let mockSearch = '';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockSearch = '';
});

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
    render(<table><tbody><WebhookRow webhook={webhook()} /></tbody></table>);
    expect(warning()).not.toBeInTheDocument();
  });

  it('shows when the pipeline has no Repo URL', () => {
    render(<table><tbody><WebhookRow webhook={webhook({ pipelineRepoUrl: null })} /></tbody></table>);
    expect(warning()).toHaveTextContent("deploy-api has no usable Repo URL, so webhook runs won't check out the pushed code.");
  });

  it('shows when the pipeline has a Repo URL Deplo cannot use', () => {
    render(<table><tbody><WebhookRow webhook={webhook({ pipelineRepoUrl: 'https://user:tok@github.com/org/repo' })} /></tbody></table>);
    expect(warning()).toHaveTextContent("deploy-api has no usable Repo URL");
  });

  // The row already says "Pipeline Not Found"; a repo warning on top would be noise.
  it('is absent when the pipeline no longer exists', () => {
    render(<table><tbody><WebhookRow webhook={webhook({ pipelineId: null, pipelineName: null, pipelineRepoUrl: null })} /></tbody></table>);
    expect(warning()).not.toBeInTheDocument();
  });
});

const setup = (over: Partial<Webhook> = {}) => render(<table><tbody><WebhookRow webhook={webhook(over)} /></tbody></table>);

describe('opening the webhook', () => {
  it('opens details from its name', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'deploy-api' }));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/webhooks?id=wh-1');
  });

  it('keeps filters and drops a leftover modal mode', async () => {
    mockSearch = 'active=inactive&recency=least-recent&mode=create';
    setup();
    await userEvent.click(screen.getByText('deploy-api'));
    expect(mockPush).toHaveBeenCalledWith('/webhooks?active=inactive&recency=least-recent&id=wh-1');
  });

  it('opens details using the keyboard', async () => {
    setup();
    screen.getByRole('button', { name: 'deploy-api' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/webhooks?id=wh-1');
  });

  it('keeps the rest of the row clickable', async () => {
    setup();
    await userEvent.click(screen.getByText('Active'));
    expect(mockPush).toHaveBeenCalledWith('/webhooks?id=wh-1');
  });
});

describe('registration details', () => {
  it('shows registration details in five aligned cells', () => {
    setup({
      events: ['push', 'pull-request'],
      environment: { name: 'prod-eu', type: 'production' },
      branchFilters: ['main', 'release/*'],
      lastDelivery: new Date('2026-01-01T12:34:56Z'),
    });
    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(5);
    expect(cells[0]).toHaveTextContent('deploy-api');
    expect(cells[1]).toHaveTextContent('Active');
    expect(cells[2]).toHaveTextContent('Push');
    expect(cells[2]).toHaveTextContent('Pull Request');
    expect(cells[3]).toHaveTextContent('prod-eu');
    expect(cells[3]).toHaveTextContent('Production');
    expect(cells[4]).toHaveTextContent('1/1/26, 12:34:56');
    expect(cells[4].querySelector('time')).toHaveAttribute('datetime', '2026-01-01T12:34:56.000Z');
  });

  it('explains absent optional data and inactive status', () => {
    setup({ isActive: false, environment: null });
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.getByText('No deliveries yet')).toBeInTheDocument();
  });

  it('keeps the warning on a full-width line', () => {
    setup({ pipelineRepoUrl: null });
    expect(screen.getByRole('note').closest('td')).toHaveAttribute('colspan', '5');
  });

  it('identifies a deleted pipeline without an extra repo warning', () => {
    setup({ pipelineId: null, pipelineName: null, pipelineRepoUrl: null });
    expect(screen.getByRole('button', { name: 'Pipeline Not Found' })).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
