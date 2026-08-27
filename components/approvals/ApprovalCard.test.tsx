import { render, screen } from '@testing-library/react';
import ApprovalCard from '@/components/approvals/ApprovalCard';

/*
 * The approval queue shows a stage waiting on a person, and the commit it is
 * waiting to promote is context rather than a required field — a pipeline with
 * no repository still raises approvals. Where the card used to print 'None' for
 * each missing git attribute, it now omits the row: three placeholder rows on a
 * card whose whole job is to make one decision legible is noise, and 'None'
 * reads as a commit named None.
 *
 * ApprovalMeta renders inside the card and owns the branch row, so its absent
 * branch is asserted here rather than in a file of its own — the two are one
 * visual unit and share a stylesheet on that basis.
 *
 * ApprovalActions is stubbed at its two boundaries (the approvals server action
 * and the toast context) to keep lib/prisma and next-auth's ESM out of the suite.
 */
jest.mock('@/lib/actions/approvals', () => ({
  approveOrRejectStage: jest.fn(),
}));

jest.mock('@/components/ui/toast/ToastContext', () => ({
  useToast: () => ({ showToast: jest.fn(), dismissStickyToasts: jest.fn() }),
}));

type Props = React.ComponentProps<typeof ApprovalCard>;

const setup = (over: Partial<Props> = {}) => {
  const props: Props = {
    id: 'appr-1',
    stageId: 'stage-1',
    runId: 'run-1',
    pipelineName: 'CI',
    runNumber: 7,
    stageName: 'deploy-prod',
    environment: { type: 'production', name: 'prod' },
    commitSha: 'abc1234',
    commitMessage: 'Fix the thing',
    createdBy: 'kyle',
    branch: 'main',
    waitingTime: '5m',
    stagesComplete: '3/5',
    ...over,
  };
  return render(<ApprovalCard {...props} />);
};

/*
 * Each conditional wraps an icon as well as its text, and the icon is the half a
 * text assertion cannot see: an unconditional span holding `null` renders nothing
 * visible either, so asserting only on absent text would pass with the
 * conditional deleted.
 */
const icon = (container: HTMLElement, name: string) =>
  container.querySelector(`ion-icon[name="${name}"]`);

describe('git metadata present', () => {
  it('renders the commit sha, message and branch', () => {
    const { container } = setup();

    expect(screen.getByText('abc1234')).toBeInTheDocument();
    expect(screen.getByText('Fix the thing')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(icon(container, 'git-commit-outline')).toBeInTheDocument();
    expect(icon(container, 'git-branch-outline')).toBeInTheDocument();
  });
});

describe('absent git metadata', () => {
  it('omits the commit sha rather than printing a placeholder', () => {
    const { container } = setup({ commitSha: null });

    expect(screen.queryByText('abc1234')).not.toBeInTheDocument();
    expect(screen.queryByText('None')).not.toBeInTheDocument();
    expect(icon(container, 'git-commit-outline')).not.toBeInTheDocument();
    expect(screen.getByText('Fix the thing')).toBeInTheDocument();
  });

  /*
   * The message has no icon of its own, so its element is asserted directly:
   * `<span>{null}</span>` puts no text on screen either, and a text-only assertion
   * would pass with the conditional deleted.
   */
  it('omits the commit message rather than printing a placeholder', () => {
    const { container } = setup({ commitMessage: null });

    expect(screen.queryByText('Fix the thing')).not.toBeInTheDocument();
    expect(screen.queryByText('No Commit Message')).not.toBeInTheDocument();
    expect(container.querySelector('.feature')).not.toBeInTheDocument();
    expect(screen.getByText('abc1234')).toBeInTheDocument();
    expect(icon(container, 'git-commit-outline')).toBeInTheDocument();
  });

  it('omits the branch row rather than printing a placeholder', () => {
    const { container } = setup({ branch: null });

    expect(screen.queryByText('main')).not.toBeInTheDocument();
    expect(screen.queryByText('None')).not.toBeInTheDocument();
    expect(icon(container, 'git-branch-outline')).not.toBeInTheDocument();
  });

  /*
   * The stage name is what the approver is actually deciding on, and the meta rows
   * that are not git-derived answer "who and how long". A run with no repository at
   * all must still say all of that, or the card stops being actionable.
   */
  it('keeps the stage name and the non-git meta rows when no git data exists', () => {
    setup({ commitSha: null, commitMessage: null, branch: null });

    expect(screen.getByText('deploy-prod')).toBeInTheDocument();
    expect(screen.getByText('kyle')).toBeInTheDocument();
    expect(screen.getByText(/5m/)).toBeInTheDocument();
    expect(screen.getByText(/3\/5 stages complete/)).toBeInTheDocument();
  });

  // The decision is the point of the card; git metadata never gates it.
  it('still offers approve and reject', () => {
    setup({ commitSha: null, commitMessage: null, branch: null });

    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
  });
});

/*
 * createdBy is not a git attribute and keeps its placeholder: a run always had
 * someone or something behind it, so the row stays and names what it can. Pinned
 * next to the omitted rows above to keep the distinction from drifting.
 */
describe('non-git placeholders', () => {
  it('names an unknown creator rather than dropping the row', () => {
    setup({ createdBy: null });

    expect(screen.getByText('Unknown Creator')).toBeInTheDocument();
  });
});
