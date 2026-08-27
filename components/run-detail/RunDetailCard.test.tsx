import { render, screen } from '@testing-library/react';
import RunDetailCard from '@/components/run-detail/RunDetailCard';

/*
 * Every git attribute on a run is optional now that a pipeline does not need a
 * repository, and the card treats them at two different levels: commitHash,
 * commitMessage and branch each hide themselves, but `repo` gates the whole
 * commit row. That asymmetry is the thing worth pinning — a run carrying a
 * commit but no repo renders none of it, which is a deliberate call rather than
 * a missed conditional. lib/data/run-detail supplies the nulls directly now, so
 * nothing downstream substitutes an em dash on the card's behalf.
 *
 * RunDetailActions is a client child importing the run-detail server actions and
 * the toast context; both are stubbed so lib/prisma — which opens a pg connection
 * at module scope — and next-auth's ESM never load. Its own behaviour is tested
 * elsewhere and has nothing to do with the commit row.
 */
jest.mock('@/lib/actions/run-detail', () => ({
  retryRun: jest.fn(),
  cancelRun: jest.fn(),
}));

jest.mock('@/components/ui/toast/ToastContext', () => ({
  useToast: () => ({ showToast: jest.fn(), dismissStickyToasts: jest.fn() }),
}));

type RunProp = React.ComponentProps<typeof RunDetailCard>['run'];

const run = (over: Partial<RunProp> = {}): RunProp => ({
  id: 'run-1',
  pipelineName: 'CI',
  runNumber: 7,
  status: 'succeeded',
  environment: { type: 'production', name: 'prod' },
  commitHash: 'abc1234',
  commitMessage: 'Fix the thing',
  branch: 'main',
  repo: 'https://github.com/o/r',
  trigger: 'manual',
  triggeredBy: 'kyle',
  duration: '30s',
  timeAgo: '2 minutes',
  ...over,
});

const setup = (over: Partial<RunProp> = {}) => render(<RunDetailCard run={run(over)} />);

/*
 * Each conditional wraps an icon as well as its text, and the icon is the half a
 * text assertion cannot see: rendering `{null}` inside an unconditional span puts
 * nothing on screen either, so asserting only on absent text would pass just as
 * happily with the conditional deleted. These names appear nowhere else on the
 * card — the trigger row uses flash/stopwatch/time.
 */
const icon = (container: HTMLElement, name: string) =>
  container.querySelector(`ion-icon[name="${name}"]`);

describe('git metadata present', () => {
  it('renders every git attribute a repo-backed run carries', () => {
    const { container } = setup();

    expect(screen.getByText('abc1234')).toBeInTheDocument();
    expect(screen.getByText('Fix the thing')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('https://github.com/o/r')).toBeInTheDocument();
    expect(icon(container, 'git-commit-outline')).toBeInTheDocument();
    expect(icon(container, 'git-branch-outline')).toBeInTheDocument();
  });
});

/*
 * Each of the three is independently optional: a run can reach the page having
 * resolved a repo but no commit (a manual trigger on a pipeline that has never
 * seen a push), so one missing field must not take the others with it.
 */
describe('individually absent git attributes', () => {
  it('hides the commit ref but keeps the rest when there is no commit hash', () => {
    const { container } = setup({ commitHash: null });

    expect(screen.queryByText('abc1234')).not.toBeInTheDocument();
    expect(icon(container, 'git-commit-outline')).not.toBeInTheDocument();
    expect(screen.getByText('Fix the thing')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(icon(container, 'git-branch-outline')).toBeInTheDocument();
    expect(screen.getByText('https://github.com/o/r')).toBeInTheDocument();
  });

  /*
   * The message is the one field with no icon of its own, so its element is
   * asserted directly: `<span>{null}</span>` puts no text on screen either, and a
   * text-only assertion would pass with the conditional deleted. The empty span is
   * not harmless — the row is a flex container with a gap, so it renders as a hole
   * between the commit ref and the branch.
   */
  it('hides the commit message but keeps the rest when there is none', () => {
    const { container } = setup({ commitMessage: null });

    expect(screen.queryByText('Fix the thing')).not.toBeInTheDocument();
    expect(container.querySelector('.rdc-commit-msg')).not.toBeInTheDocument();
    expect(screen.getByText('abc1234')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(icon(container, 'git-commit-outline')).toBeInTheDocument();
  });

  it('hides the branch but keeps the rest when there is none', () => {
    const { container } = setup({ branch: null });

    expect(screen.queryByText('main')).not.toBeInTheDocument();
    expect(icon(container, 'git-branch-outline')).not.toBeInTheDocument();
    expect(screen.getByText('abc1234')).toBeInTheDocument();
    expect(icon(container, 'git-commit-outline')).toBeInTheDocument();
    expect(screen.getByText('Fix the thing')).toBeInTheDocument();
  });

  it('still renders the repo link for a run with no commit data at all', () => {
    const { container } = setup({ commitHash: null, commitMessage: null, branch: null });

    expect(screen.getByText('https://github.com/o/r')).toBeInTheDocument();
    expect(icon(container, 'open-outline')).toBeInTheDocument();
  });
});

/*
 * The repo is the row's reason to exist. Without one there is nowhere for the
 * commit ref or branch to point, so the row goes rather than rendering orphaned
 * fragments — the assertions below deliberately hand the card a full set of
 * commit data to prove `repo` overrides it.
 */
describe('no repository', () => {
  it('drops the entire commit row even when commit data is present', () => {
    const { container } = setup({ repo: null });

    expect(screen.queryByText('abc1234')).not.toBeInTheDocument();
    expect(screen.queryByText('Fix the thing')).not.toBeInTheDocument();
    expect(screen.queryByText('main')).not.toBeInTheDocument();
    expect(icon(container, 'git-commit-outline')).not.toBeInTheDocument();
    expect(icon(container, 'git-branch-outline')).not.toBeInTheDocument();
    expect(icon(container, 'open-outline')).not.toBeInTheDocument();
  });

  it('leaves everything that is not git metadata on screen', () => {
    setup({ repo: null, commitHash: null, commitMessage: null, branch: null });

    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.getByText('#7')).toBeInTheDocument();
    expect(screen.getByText('Succeeded')).toBeInTheDocument();
    expect(screen.getByText('prod')).toBeInTheDocument();
    expect(screen.getByText(/Triggered by manual/)).toBeInTheDocument();
    expect(screen.getByText('Duration: 30s')).toBeInTheDocument();
    expect(screen.getByText(/Triggered 2 minutes ago/)).toBeInTheDocument();
  });

  /*
   * A run with no repo is still a run: cancel and re-run are decided by status,
   * not by whether the pipeline came from git. Pinned because gating the commit
   * row is one conditional away from gating the row that holds the actions.
   */
  it('still offers the status-appropriate action', () => {
    setup({ repo: null, status: 'running' });

    expect(screen.getByRole('button', { name: /cancel run/i })).toBeInTheDocument();
  });
});
