import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const pipeline = (over: Partial<Pipeline> = {}): Pipeline => ({
  id: 'p1',
  name: 'CI',
  description: null,
  repoUrl: 'https://github.com/o/web-client',
  defaultEnvironmentId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  status: 'succeeded',
  lastRun: 'run-9',
  runNumber: 12,
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

  it('keeps the name, latest run number and status', () => {
    setup({ repoUrl: null });

    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.getByText('Latest Run: #12')).toBeInTheDocument();
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

/*
 * The row opens the pipeline modal by pushing ?id=, and the list page keeps its filters in
 * the same query string — so the push has to add the id to what is there, not replace it.
 */
describe('opening the pipeline', () => {
  it('pushes the pipeline id onto /pipelines', async () => {
    setup();

    await userEvent.click(screen.getByText('CI'));

    expect(mockPush).toHaveBeenCalledWith('/pipelines?id=p1');
  });

  it('keeps the filters already in the URL', async () => {
    mockSearch = 'status=failed';
    setup();

    await userEvent.click(screen.getByText('CI'));

    expect(mockPush).toHaveBeenCalledWith('/pipelines?status=failed&id=p1');
  });

  // A stale mode (say, from a create modal left in history) must not ride along into view mode.
  it('drops a leftover mode', async () => {
    mockSearch = 'status=failed&mode=create';
    setup();

    await userEvent.click(screen.getByText('CI'));

    expect(mockPush).toHaveBeenCalledWith('/pipelines?status=failed&id=p1');
  });

  it('does not open the modal when the latest-run link is clicked', async () => {
    setup();

    await userEvent.click(screen.getByRole('link', { name: /view the latest run of CI/i }));

    expect(mockPush).not.toHaveBeenCalled();
  });
});
