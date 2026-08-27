import { render, screen } from '@testing-library/react';
import PipelineRow from '@/components/pipelines/PipelineRow';
import type { Pipeline } from '@/lib/data/pipelines';

/*
 * `repoUrl` is nullable on the Pipeline model itself, so this row is the one
 * place the absence shows up as a pipeline's own property rather than as missing
 * data on a run. The row keeps a placeholder in the repository cell for the same
 * reason WebhookEventRow does — the cells are read against the table header.
 *
 * lib/data/pipelines is imported for its type only, but Jest still loads the
 * module and it pulls in the Prisma singleton, which opens a pg connection at
 * module scope. next/navigation is stubbed because the row pushes on click.
 */
jest.mock('@/lib/prisma');

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const pipeline = (over: Partial<Pipeline> = {}): Pipeline => ({
  id: 'p1',
  name: 'CI',
  description: null,
  repoUrl: 'https://github.com/o/web-client',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  status: 'succeeded',
  lastRun: 'run-9',
  runCount: 12,
  commitMessage: 'Fix the thing',
  ...over,
});

const setup = (over: Partial<Pipeline> = {}) =>
  render(
    <table><tbody><PipelineRow pipeline={pipeline(over)} /></tbody></table>,
  );

/** Column order: pipeline, status, repository, latest run, editor link. */
const cell = (index: number) => screen.getAllByRole('cell')[index];
const repository = () => cell(2);
const latestRun = () => cell(3);

/*
 * The cell links to the run rather than printing its id: a cuid is unreadable and
 * tells a reader nothing a timestamp or a status would not tell them better. Both
 * links in the row stop propagation, or the click also fires the row's own push to
 * the pipeline modal and the reader lands somewhere they did not ask for.
 */
describe('latest run link', () => {
  it('links to the run detail page for the newest run', () => {
    setup();

    expect(screen.getByRole('link', { name: /view the latest run of CI/i }))
      .toHaveAttribute('href', '/runs/run-9');
  });

  it('does not print the run id', () => {
    setup();

    expect(latestRun()).not.toHaveTextContent('run-9');
  });

  // A pipeline that has never run has nothing to link to, and an empty cell would
  // read as a rendering fault rather than as an absence.
  it('says so when the pipeline has never run', () => {
    setup({ lastRun: null });

    expect(latestRun()).toHaveTextContent('No Runs');
    expect(screen.queryByRole('link', { name: /view the latest run/i })).not.toBeInTheDocument();
  });
});

describe('repository present', () => {
  it('renders the repo name and its commit message', () => {
    setup();

    expect(repository()).toHaveTextContent('web-client');
    expect(repository()).toHaveTextContent('Fix the thing');
  });
});

describe('no repository', () => {
  it('renders an em dash in the repository cell', () => {
    setup({ repoUrl: null });

    expect(repository()).toHaveTextContent('—');
  });

  /*
   * The commit message is the repo's news. Without a repo there is nothing it
   * could describe, so it goes with it rather than sitting under an em dash —
   * and a stale message on a pipeline that has since dropped its repo would be
   * actively misleading.
   */
  it('suppresses a commit message with no repository above it', () => {
    setup({ repoUrl: null });

    expect(repository()).not.toHaveTextContent('Fix the thing');
  });

  it('keeps the name, run count and status', () => {
    setup({ repoUrl: null });

    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.getByText('12 Runs')).toBeInTheDocument();
    expect(screen.getByText('Succeeded')).toBeInTheDocument();
  });

  /*
   * The editor is where a pipeline's stages are drawn, which has nothing to do
   * with where its code lives — a repo-less pipeline is exactly the one someone
   * needs to open and configure by hand.
   */
  it('still links to the pipeline editor', () => {
    setup({ repoUrl: null });

    expect(screen.getByRole('link', { name: /open CI in the pipeline editor/i }))
      .toHaveAttribute('href', '/pipelines/p1');
  });

  it('renders all five cells so the columns stay aligned', () => {
    setup({ repoUrl: null });

    expect(screen.getAllByRole('cell')).toHaveLength(5);
  });
});
