import { getDefaultNormalizer, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WebhookEventRow from '@/components/webhook-events/WebhookEventRow';
import type { WebhookEvent } from '@/lib/data/webhook-events';

/*
 * A webhook event can outlive the pipeline it arrived for (`onDelete: SetNull`),
 * and the pipeline it points at need not have a repository, so `pipeline` and
 * `pipeline.repoUrl` are two separate absences the row has to survive. It is a
 * table row rather than a card, so unlike ApprovalCard it keeps a placeholder in
 * every cell — a column with nothing in it reads as a rendering fault, and the
 * cells have to line up with their headers.
 *
 * lib/data/webhook-events is imported for its type only, but Jest still loads the
 * module and it pulls in the Prisma singleton, which opens a pg connection at
 * module scope. next/navigation is stubbed because the row pushes on click.
 */
jest.mock('@/lib/prisma');

/*
 * mock-prefixed so the hoisted factory may close over them; both are read at render or
 * click time, after the module body has run.
 */
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

const event = (over: Partial<WebhookEvent> = {}): WebhookEvent => ({
  id: 'evt-1',
  pipelineId: 'p1',
  webhookId: 'wh-1',
  eventType: 'push',
  source: 'github',
  payload: {},
  headers: {},
  status: 'processed',
  statusReason: 'Started CI #4.',
  replayBlockedReason: null,
  runId: 'run-1',
  receivedAt: new Date('2026-01-01T00:00:00Z'),
  commitSha: 'abc1234',
  commitMessage: 'Fix the thing',
  branch: 'refs/heads/main',
  pipeline: { name: 'CI', repoUrl: 'https://github.com/o/web-client' },
  ...over,
});

const setup = (over: Partial<WebhookEvent> = {}) =>
  render(
    <table><tbody><WebhookEventRow event={event(over)} /></tbody></table>,
  );

/** Column order: status, type, repository, branch, commit, pipeline, received. */
const cell = (index: number) => screen.getAllByRole('cell')[index];
const repository = () => cell(2);
const branch = () => cell(3);
const commit = () => cell(4);
const pipeline = () => cell(5);

describe('git metadata present', () => {
  it('renders the repo name, branch and commit', () => {
    setup();

    expect(repository()).toHaveTextContent('web-client');
    expect(branch()).toHaveTextContent('main');
    expect(commit()).toHaveTextContent('abc1234');
    expect(commit()).toHaveTextContent('Fix the thing');
  });

  it('links the repository by name', () => {
    setup();

    expect(screen.getByRole('link', { name: 'web-client' })).toHaveAttribute('href', 'https://github.com/o/web-client');
  });
  
  it('follows the repo link without opening the modal', async () => {
    setup();

    await userEvent.click(screen.getByRole('link', { name: 'web-client' }));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows a seven-character sha and a truncated message, full values as titles', () => {
    const sha = '9e2a06f0970deb2b6b8aa7d91ec797e0ece667dd';
    const message = "feat: in 'create' mode, users can mask and copy a webhook secret";
    setup({ commitSha: sha, commitMessage: message });

    expect(screen.getByText('9e2a06f')).toHaveAttribute('title', sha);
    expect(screen.getByText("feat: in 'create' mode, users ...")).toHaveAttribute('title', message);
  });
});

describe('absent git metadata', () => {
  it('renders an em dash for a pipeline with no repository', () => {
    setup({ pipeline: { name: 'CI', repoUrl: null } });

    expect(repository()).toHaveTextContent('—');
    expect(pipeline()).toHaveTextContent('CI');
  });

  it('renders an em dash for the repository when the pipeline itself is gone', () => {
    setup({ pipeline: null });

    expect(repository()).toHaveTextContent('—');
    expect(pipeline()).toHaveTextContent('None');
  });

  it('renders an em dash for a missing branch', () => {
    setup({ branch: null });

    expect(branch()).toHaveTextContent('—');
  });

  it('renders an em dash for a missing commit sha', () => {
    setup({ commitSha: null, commitMessage: null });

    expect(commit()).toHaveTextContent('—');
  });

  /*
   * The message hangs off the sha in the same cell, so it is suppressed with it:
   * a bare subject line under an em dash reads as the message belonging to a
   * commit the row just said it does not have.
   */
  it('suppresses a commit message that has no sha above it', () => {
    setup({ commitSha: null });

    expect(commit()).toHaveTextContent('—');
    expect(commit()).not.toHaveTextContent('Fix the thing');
  });

  it('renders the sha alone when the message is the missing half', () => {
    setup({ commitMessage: null });

    expect(commit()).toHaveTextContent('abc1234');
  });
});

/*
 * Every cell keeps its place regardless of how much is missing — the row is read
 * against the table header, and a dropped cell shifts every column after it.
 */
describe('column alignment', () => {
  it('renders all seven cells for an event with no git data at all', () => {
    setup({ pipeline: null, branch: null, commitSha: null, commitMessage: null });

    expect(screen.getAllByRole('cell')).toHaveLength(7);
  });
});

/*
 * The row opens the event modal by pushing ?id=, and the list page keeps its filters in the
 * same query string. The path is absolute: this row used to push the relative `events?id=`,
 * which only resolved correctly because of where the page happens to live.
 */
describe('opening the event', () => {
  it('pushes the event id onto /webhooks/events', async () => {
    setup();

    await userEvent.click(screen.getAllByRole('cell')[0]);

    expect(mockPush).toHaveBeenCalledWith('/webhooks/events?id=evt-1');
  });

  it('keeps the filters already in the URL', async () => {
    mockSearch = 'status=failed&event-type=push';
    setup();

    await userEvent.click(screen.getAllByRole('cell')[0]);

    expect(mockPush).toHaveBeenCalledWith('/webhooks/events?status=failed&event-type=push&id=evt-1');
  });
});

describe('the status reason', () => {
  const status = () => cell(0);

  it('shows under the status pill', () => {
    setup({ status: 'ignored', statusReason: 'Branch "dev" does not match the branch filters (main).' });

    expect(status()).toHaveTextContent('Ignored');
    expect(status()).toHaveTextContent('Branch "dev" does not match the branch filters (main).');
  });

  // A long reason (a pipeline's validation errors) is cut to one line in the table, so the
  // full text has to stay reachable on hover; the modal shows it in full.
  it('keeps the full reason in the title for when it is cut short', () => {
    const reason = 'Cannot run pipeline:\n• Stage "build" has no command.';
    setup({ statusReason: reason });

    // Compared exactly: the default normalizer would collapse the line break being checked.
    expect(screen.getByTitle(reason, { normalizer: getDefaultNormalizer({ collapseWhitespace: false, trim: false }) })).toBeInTheDocument();
  });

  it('shows the pill alone for an event with no reason yet', () => {
    setup({ status: 'pending', statusReason: null });

    expect(status()).toHaveTextContent(/^Pending$/);
  });
});

describe('the replay marker', () => {
  const eventCell = () => cell(1);

  // A replay copies the original's payload, so its commit, branch and repository match the
  // original's; without a marker the two rows are indistinguishable in the list.
  it('marks a replayed event in the event column', () => {
    setup({ source: 'replay' });

    expect(eventCell()).toHaveTextContent('Push');
    expect(eventCell()).toHaveTextContent('Replay');
  });

  it('leaves a GitHub delivery unmarked', () => {
    setup({ source: 'github' });

    expect(eventCell()).toHaveTextContent(/^Push$/);
  });
});
