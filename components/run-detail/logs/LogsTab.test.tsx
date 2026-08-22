import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LogsTab from '@/components/run-detail/logs/LogsTab';
import type { JobLog, LogFilters } from '@/lib/data/run-detail';

/*
 * Two controls that have to agree: the stage listbox picks what LogViewer shows,
 * and the attempts listbox has to follow it there. They agree only by construction
 * — LogsTab holds the attempt, FilterListbox holds a copy of it, and FilterListbox
 * reads its copy once, from the useState initializer. So the assertions below are
 * about the moments the two can drift apart, and every one of them checks the
 * attempts trigger against what LogViewer is actually rendering.
 *
 * lib/data/run-detail is imported for its types only, but Jest still loads the
 * module, and it pulls in the Prisma singleton.
 */
jest.mock('@/lib/prisma');

const FILTERS: LogFilters[] = [
  { value: 's1', label: 'typecheck', status: 'succeeded' },
  { value: 's2', label: 'unit-tests', status: 'succeeded' },
];

const log = (stageId: string, jobName: string, attempt: number): JobLog => ({
  stageId,
  jobName,
  command: `npm run ${jobName}`,
  attempt,
  status: 'succeeded',
  duration: '1s',
  lines: [{ lineNumber: 1, content: `${jobName} attempt ${attempt}` }],
});

/* typecheck passed first time; unit-tests needed three goes. */
const LOGS: JobLog[] = [
  log('s1', 'typecheck', 1),
  log('s2', 'unit-tests', 1),
  log('s2', 'unit-tests', 2),
  log('s2', 'unit-tests', 3),
];

const setup = (logs: JobLog[] = LOGS, logFilters: LogFilters[] = FILTERS) => {
  const user = userEvent.setup();
  const { rerender } = render(<LogsTab logs={logs} logFilters={logFilters} />);

  /*
   * Stands in for an AutoRefresh tick: router.refresh() re-executes the server component
   * and reconciles the result into the existing tree, so the props change while every
   * piece of state in here survives. A fresh render() would prove nothing.
   */
  const poll = (logs: JobLog[], logFilters: LogFilters[] = FILTERS) =>
    rerender(<LogsTab logs={logs} logFilters={logFilters} />);

  return { user, poll };
};

/*
 * Re-queried on every use rather than captured once, because switching stages remounts
 * the attempts listbox — a handle taken before the switch is detached from the document
 * afterwards, and asserting against it silently reads the old control.
 */
const stages = () => screen.getAllByRole('combobox')[0];
const attempts = () => screen.getAllByRole('combobox')[1];

/* Both listboxes render their options into the same document, so open one at a time. */
const choose = async (
  user: ReturnType<typeof userEvent.setup>,
  trigger: () => HTMLElement,
  label: string,
) => {
  await user.click(trigger());
  await user.click(within(screen.getByRole('listbox')).getByText(label));
};

describe('the attempt the two controls report', () => {
  it('opens on the newest attempt of the first stage', () => {
    setup();

    expect(attempts()).toHaveTextContent('Attempt 1');
    expect(screen.getByText('typecheck attempt 1')).toBeInTheDocument();
  });

  /*
   * The reported bug: switching to a stage whose attempt numbers overlap the previous
   * one left the trigger showing an attempt LogViewer had already moved off.
   */
  it('follows the stage switch to that stage\'s newest attempt', async () => {
    const { user } = setup();

    await choose(user, stages, 'unit-tests');

    expect(attempts()).toHaveTextContent('Attempt 3');
    expect(screen.getByText('unit-tests attempt 3')).toBeInTheDocument();
  });

  it('offers every attempt of the stage switched to', async () => {
    const { user } = setup();
    await choose(user, stages, 'unit-tests');

    await user.click(attempts());

    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Attempt 1', 'Attempt 2', 'Attempt 3']);
  });

  it('shows the attempt the user picks', async () => {
    const { user } = setup();
    await choose(user, stages, 'unit-tests');

    await choose(user, attempts, 'Attempt 1');

    expect(attempts()).toHaveTextContent('Attempt 1');
    expect(screen.getByText('unit-tests attempt 1')).toBeInTheDocument();
  });

  /* A chosen attempt belongs to the stage it was chosen on, not to the next one. */
  it('drops a chosen attempt when the stage changes again', async () => {
    const { user } = setup();
    await choose(user, stages, 'unit-tests');
    await choose(user, attempts, 'Attempt 1');

    await choose(user, stages, 'typecheck');

    expect(attempts()).toHaveTextContent('Attempt 1');
    expect(screen.getByText('typecheck attempt 1')).toBeInTheDocument();
  });

  it('returns to the newest attempt when the stage is revisited', async () => {
    const { user } = setup();
    await choose(user, stages, 'unit-tests');
    await choose(user, attempts, 'Attempt 1');
    await choose(user, stages, 'typecheck');

    await choose(user, stages, 'unit-tests');

    expect(attempts()).toHaveTextContent('Attempt 3');
    expect(screen.getByText('unit-tests attempt 3')).toBeInTheDocument();
  });
});

/*
 * The run is still going while the tab is open, so `logs` grows under state that a
 * refresh deliberately preserves. Whatever the reader is looking at has to survive that
 * — a retry opening is the runner's news, not a request to be taken somewhere else.
 */
describe('a refresh that arrives while the tab is open', () => {
  const BEFORE_RETRY = LOGS.filter((l) => l.attempt < 3);

  it('holds the attempt being read when a retry opens', async () => {
    const { user, poll } = setup(BEFORE_RETRY);
    await choose(user, stages, 'unit-tests');
    expect(attempts()).toHaveTextContent('Attempt 2');

    poll(LOGS);

    expect(attempts()).toHaveTextContent('Attempt 2');
    expect(screen.getByText('unit-tests attempt 2')).toBeInTheDocument();
  });

  it('holds an attempt the reader chose', async () => {
    const { user, poll } = setup(BEFORE_RETRY);
    await choose(user, stages, 'unit-tests');
    await choose(user, attempts, 'Attempt 1');

    poll(LOGS);

    expect(attempts()).toHaveTextContent('Attempt 1');
    expect(screen.getByText('unit-tests attempt 1')).toBeInTheDocument();
  });

  it('offers the new attempt without moving to it', async () => {
    const { user, poll } = setup(BEFORE_RETRY);
    await choose(user, stages, 'unit-tests');
    poll(LOGS);

    await user.click(attempts());

    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Attempt 1', 'Attempt 2', 'Attempt 3']);
    expect(attempts()).toHaveTextContent('Attempt 2');
  });

  /* A tab opened on a queued run has no stages to pick from, and the initializer that
     seeds the first one runs before they exist. */
  it('picks up the stages when they arrive after mount', () => {
    const { poll } = setup([], []);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    poll(LOGS);

    expect(stages()).toHaveTextContent('typecheck');
    expect(attempts()).toHaveTextContent('Attempt 1');
    expect(screen.getByText('typecheck attempt 1')).toBeInTheDocument();
  });
});
