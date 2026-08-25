import { render, screen } from '@testing-library/react';
import RunnerStatusBanner from '@/components/run-detail/RunnerStatusBanner';

/*
 * The banner is the only thing on the Run Detail page that says why a queued run is not
 * moving, so the assertions are about the words: the two unavailable reasons have to read
 * differently, or separating them in lib/queue/health.ts bought nothing.
 *
 * Whether it renders at all is the page's decision and belongs to the E2E tier — an async
 * server component is not something Jest can render.
 */

describe('RunnerStatusBanner', () => {
  it('names the runner when nothing is consuming the queue', () => {
    render(<RunnerStatusBanner reason="no-workers" />);

    expect(screen.getByText('Runner Not Available')).toBeInTheDocument();
    expect(screen.getByText(/will not progress until one is started/)).toBeInTheDocument();
  });

  /*
   * A different failure and deliberately different words. 'no-workers' is answered by
   * starting the runner; this one is not, and it also means no new run can be triggered —
   * telling someone to start a runner they cannot reach sends them the wrong way.
   */
  it('names the queue when Redis itself could not be reached', () => {
    render(<RunnerStatusBanner reason="unreachable" />);

    expect(screen.getByText('Queue Unreachable')).toBeInTheDocument();
    expect(screen.getByText(/new runs cannot be triggered/)).toBeInTheDocument();
  });

  // Announced rather than silent: the banner appears on a poll, under a reader who is
  // already looking at the page and has no reason to re-scan it.
  it('exposes itself as a status region', () => {
    render(<RunnerStatusBanner reason="no-workers" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
