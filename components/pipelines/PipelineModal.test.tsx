import { render, screen } from '@testing-library/react';
import PipelineModal from '@/components/pipelines/PipelineModal';

/*
 * The modal is where a pipeline's optional repository is both shown and set, so
 * it carries the two halves of that change: the view drops the Repo URL block
 * when there is nothing to show, and the form no longer marks the field
 * `required`. The second is the load-bearing one — leaving `required` on would
 * make a repo-less pipeline unsaveable through the UI no matter what the schema
 * permits, and nothing in the data layer would report it.
 *
 * The server actions are mocked because what is under test is the modal's own
 * rendering; it is the same shape as SecretModal, whose suite covers the
 * useActionState lifecycle.
 */
jest.mock('@/lib/actions/pipelines', () => ({
  addPipeline: jest.fn(async () => ({ status: 'idle', message: '' })),
  updatePipeline: jest.fn(async () => ({ status: 'idle', message: '' })),
  deletePipeline: jest.fn(async () => ({ status: 'success', message: '' })),
}));

type Props = React.ComponentProps<typeof PipelineModal>;

const setup = (over: Partial<Props> = {}) => {
  const props: Props = {
    mode: 'view',
    id: 'p1',
    name: 'CI',
    status: 'succeeded',
    lastRun: 'run-9',
    repoUrl: 'https://github.com/o/web-client',
    commitMessage: 'Fix the thing',
    description: null,
    branchFilters: [],
    createdBy: 'kyle',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    onClose: jest.fn(),
    onCreate: jest.fn(),
    onDelete: jest.fn(),
    onEdit: jest.fn(),
    onEditOrDeleteClose: jest.fn(),
    onSave: jest.fn(),
    onError: jest.fn(),
    ...over,
  };
  return render(<PipelineModal {...props} />);
};

describe('view mode', () => {
  it('shows the repo url and its commit message', () => {
    setup();

    expect(screen.getByText('Repo URL')).toBeInTheDocument();
    expect(screen.getByText('https://github.com/o/web-client')).toBeInTheDocument();
    expect(screen.getByText('Fix the thing')).toBeInTheDocument();
  });

  /*
   * The modal names the link rather than showing it as a bare icon: unlike the
   * table cell, this is a standalone field under a label, where an icon alone
   * leaves the reader guessing what it opens.
   */
  it('links to the latest run instead of printing its id', () => {
    setup();

    const link = screen.getByRole('link', { name: /view run/i });

    expect(link).toHaveAttribute('href', '/runs/run-9');
    expect(screen.queryByText('run-9')).not.toBeInTheDocument();
  });

  it('omits the last run field for a pipeline that has never run', () => {
    setup({ lastRun: null });

    expect(screen.queryByText('Last Run')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view run/i })).not.toBeInTheDocument();
  });

  it('drops the whole repo url block when there is none', () => {
    setup({ repoUrl: null });

    expect(screen.queryByText('Repo URL')).not.toBeInTheDocument();
  });

  /*
   * The commit message lives inside that block, so it goes with it. Asserted with
   * a message deliberately still set, since the block is gated on the repo alone.
   */
  it('takes the commit message with it', () => {
    setup({ repoUrl: null });

    expect(screen.queryByText('Fix the thing')).not.toBeInTheDocument();
  });

  it('keeps the fields that are not repo-derived', () => {
    setup({ repoUrl: null, commitMessage: null });

    expect(screen.getByText('CI')).toBeInTheDocument();
    expect(screen.getByText('Succeeded')).toBeInTheDocument();
    expect(screen.getByText('kyle')).toBeInTheDocument();
  });
});

/*
 * A pipeline with no repository has to be creatable and editable, which means the
 * field the schema now allows to be null must not be blocked by the form.
 */
describe.each(['create', 'edit'] as const)('%s mode', (mode) => {
  it('does not require a repo url', () => {
    setup({ mode, repoUrl: null });

    expect(screen.getByLabelText(/repo url/i)).not.toBeRequired();
  });

  it('still requires a name', () => {
    setup({ mode, repoUrl: null });

    expect(screen.getByLabelText(/name/i)).toBeRequired();
  });

  it('renders an empty repo url field rather than the string "null"', () => {
    setup({ mode, repoUrl: null });

    expect(screen.getByLabelText(/repo url/i)).toHaveValue('');
  });
});
