import { act, fireEvent, render, screen } from '@testing-library/react';
import RefreshButton from '@/components/layout/subheader/RefreshButton';

/*
 * An explicit factory rather than a bare jest.mock: automocking next/navigation
 * loads the real module to introspect it and drags in Next's server runtime.
 */
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

/*
 * Must match FEEDBACK_MS in RefreshButton. The button holds its pending state for
 * that long on purpose: router.refresh() against unchanged data settles in a few
 * milliseconds, and a spinner that lives that briefly never paints, which is what
 * makes a working refresh button read as a broken one. Everything below runs on
 * fake timers so the hold is deterministic rather than a real 400ms per case.
 */
const FEEDBACK_MS = 400;

const settle = () => act(async () => { jest.advanceTimersByTime(FEEDBACK_MS); });

beforeEach(() => { jest.useFakeTimers(); mockRefresh.mockClear(); });
afterEach(() => { jest.useRealTimers(); });

describe('RefreshButton', () => {
  it('refreshes the page when clicked', async () => {
    render(<RefreshButton />);

    fireEvent.click(screen.getByRole('button'));

    expect(mockRefresh).toHaveBeenCalledTimes(1);

    await settle();
  });

  it('shows a pending state until the feedback window elapses', async () => {
    render(<RefreshButton />);

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveTextContent('Refreshing');

    await settle();

    expect(screen.getByRole('button')).toBeEnabled();
    expect(screen.getByRole('button')).toHaveTextContent('Refresh');
  });

  it('ignores a second click while a refresh is in flight', async () => {
    render(<RefreshButton />);
    const button = screen.getByRole('button');

    fireEvent.click(button);
    fireEvent.click(button);

    expect(mockRefresh).toHaveBeenCalledTimes(1);

    await settle();
  });
});
