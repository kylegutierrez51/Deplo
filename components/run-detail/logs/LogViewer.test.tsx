import { render, screen } from '@testing-library/react';
import LogViewer from './LogViewer';
import type { JobLog, LogStatus } from '@/lib/data/run-detail';

/*
 * One property carries this file: the ion-icon's `class` attribute must not change when the
 * status does.
 *
 * ion-icon is a Stencil custom element. Its runtime adds `md` and `hydrated` to the host's
 * own class list when the element upgrades, and an un-hydrated host does not render. React
 * owns `class` through className, and rewrites the whole attribute whenever that string
 * changes value — taking those two runtime classes with it. The element stays in the DOM,
 * stops rendering, and never recovers, because a custom element upgrades exactly once.
 *
 * The symptom is nasty precisely because the first paint is fine: React writes className at
 * mount, the runtime appends its classes afterwards, and only the *second* render destroys
 * them. So the icon works until the reader switches stage, then is gone for the rest of the
 * page's life — including on the stage that had just rendered it.
 *
 * jsdom does not run Stencil, so no test here can observe `hydrated` directly. What it can
 * do is pin the cause: className stays constant and the status travels on a data attribute.
 */

const log = (status: LogStatus): JobLog => ({
  stageId: 'build',
  jobName: 'unit-tests-2',
  command: 'npm test',
  attempt: 1,
  status,
  duration: '12s',
  lines: [{ lineNumber: 1, content: 'output' }],
});

const icon = (container: HTMLElement) => container.querySelector('ion-icon')!;

describe('the status icon', () => {
  it.each<[LogStatus, string]>([
    ['succeeded', 'checkmark-circle-outline'],
    ['failed', 'close-circle-outline'],
    ['running', 'sync-outline'],
    ['cancelled', 'ban-outline'],
  ])('renders the %s glyph', (status, name) => {
    const { container } = render(<LogViewer log={log(status)} />);

    expect(icon(container)).toHaveAttribute('name', name);
  });

  it.each<LogStatus>(['succeeded', 'failed', 'running', 'cancelled'])(
    'reports %s on a data attribute rather than in the class', (status) => {
      const { container } = render(<LogViewer log={log(status)} />);

      expect(icon(container)).toHaveAttribute('data-status', status);
      expect(icon(container).getAttribute('class')).not.toContain(status);
    });

  /*
   * The regression test proper. Re-rendering with a different status must leave `class`
   * byte-identical — anything else means React is rewriting the attribute, which is what
   * strips the classes the Ionicons runtime put there.
   */
  it('keeps the class attribute untouched when the status changes', () => {
    const { container, rerender } = render(<LogViewer log={log('running')} />);
    const before = icon(container).getAttribute('class');

    rerender(<LogViewer log={log('cancelled')} />);

    expect(icon(container).getAttribute('class')).toBe(before);
    expect(icon(container)).toHaveAttribute('data-status', 'cancelled');
  });

  /*
   * And the same element throughout: a `key` on the icon would also dodge the bug, by
   * throwing the host away and letting a fresh one upgrade. That works, but it re-fetches
   * the glyph on every switch and quietly stops working if someone removes the key. This
   * pins the constant-className fix instead, so a later `key` cannot mask its removal.
   */
  it('reuses the same element rather than remounting it', () => {
    const { container, rerender } = render(<LogViewer log={log('running')} />);
    const before = icon(container);

    rerender(<LogViewer log={log('succeeded')} />);

    expect(icon(container)).toBe(before);
  });
});

describe('the footer', () => {
  // A plain span, so its className is free to carry the status — React rewriting class on
  // an ordinary element costs nothing.
  it.each<[LogStatus, string]>([
    ['succeeded', 'Process exited with code 0'],
    ['failed', 'Process exited with code 1'],
    ['running', 'Running...'],
    ['cancelled', 'Process cancelled.'],
  ])('reports %s', (status, text) => {
    render(<LogViewer log={log(status)} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
