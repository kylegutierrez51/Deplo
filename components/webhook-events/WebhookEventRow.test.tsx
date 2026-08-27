import { render, screen } from '@testing-library/react';
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

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const event = (over: Partial<WebhookEvent> = {}): WebhookEvent => ({
  id: 'evt-1',
  pipelineId: 'p1',
  eventType: 'push',
  source: 'github',
  payload: {},
  headers: {},
  status: 'processed',
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
