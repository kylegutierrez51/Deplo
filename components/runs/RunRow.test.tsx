import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RunRow from '@/components/runs/RunRow';
import type { Run } from '@/lib/data/runs';

/*
 * lib/data/runs is imported for its type only, but Jest still loads the module and it
 * pulls in the Prisma singleton, which opens a pg connection at module scope.
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

const run = (over: Partial<Run> = {}): Run => ({
  id: 'run-1',
  pipelineId: 'p1',
  definitionId: 'd1',
  environmentId: null,
  environment: null,
  status: 'succeeded',
  trigger: 'manual',
  runNumber: 7,
  commitSha: null,
  branch: null,
  pipelineName: 'CI',
  repoUrl: null,
  triggeredBy: null,
  startedAt: null,
  finishedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

const setup = (over: Partial<Run> = {}) =>
  render(<table><tbody><RunRow run={run(over)} /></tbody></table>);

/*
 * The row opens the run modal by pushing ?id=, and /runs keeps its filters in the same
 * query string — so the push adds the id to what is there rather than replacing it.
 */
describe('opening the run', () => {
  it('pushes the run id onto /runs', async () => {
    setup();

    await userEvent.click(screen.getByText('CI'));

    expect(mockPush).toHaveBeenCalledWith('/runs?id=run-1');
  });

  it('keeps the filters already in the URL', async () => {
    mockSearch = 'status=failed&trigger=webhook';
    setup();

    await userEvent.click(screen.getByText('CI'));

    expect(mockPush).toHaveBeenCalledWith('/runs?status=failed&trigger=webhook&id=run-1');
  });

  it('drops a leftover mode', async () => {
    mockSearch = 'status=failed&mode=create';
    setup();

    await userEvent.click(screen.getByText('CI'));

    expect(mockPush).toHaveBeenCalledWith('/runs?status=failed&id=run-1');
  });
});
