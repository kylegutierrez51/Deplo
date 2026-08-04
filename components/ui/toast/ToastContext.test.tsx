import { act, renderHook } from '@testing-library/react';
import { ToastProvider, useToast } from '@/components/ui/toast/ToastContext';

/*
 * A timer state machine, so everything here runs on fake timers. The two
 * constants it is built around are TOTAL_DURATION 3000 and EXIT_DURATION 200:
 * a toast flips to `exiting` at 2800 to run its animation, then leaves at 3000.
 */

const TOTAL_DURATION = 3000;
const EXIT_DURATION = 200;

const renderToasts = () => renderHook(() => useToast(), { wrapper: ToastProvider });

const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

describe('useToast', () => {
  it('throws outside a provider', () => {
    jest.spyOn(console, 'error').mockImplementation(() => { });

    expect(() => renderHook(() => useToast())).toThrow('useToast must be used within ToastProvider');

    jest.restoreAllMocks();
  });

  it('starts with no toasts', () => {
    expect(renderToasts().result.current.toasts).toEqual([]);
  });
});

describe('showToast', () => {
  it('adds a toast that is not yet exiting', () => {
    const { result } = renderToasts();

    act(() => { result.current.showToast('Saved', 'checkmark-circle-outline'); });

    expect(result.current.toasts).toEqual([
      { id: 0, text: 'Saved', icon: 'checkmark-circle-outline', exiting: false, sticky: false },
    ]);
  });

  it('gives each toast a monotonically increasing id', () => {
    const { result } = renderToasts();

    act(() => {
      result.current.showToast('one', 'checkmark-circle-outline');
      result.current.showToast('two', 'trash-outline');
    });

    expect(result.current.toasts.map(t => t.id)).toEqual([0, 1]);
  });

  it('stacks toasts in the order they were raised', () => {
    const { result } = renderToasts();

    act(() => {
      result.current.showToast('first', 'checkmark-circle-outline');
      result.current.showToast('second', 'trash-outline');
    });

    expect(result.current.toasts.map(t => t.text)).toEqual(['first', 'second']);
  });
});

describe('auto dismissal', () => {
  it('is still fully visible just before the exit animation starts', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast('Saved', 'checkmark-circle-outline'); });

    advance(TOTAL_DURATION - EXIT_DURATION - 1);

    expect(result.current.toasts[0].exiting).toBe(false);
  });

  it('flips to exiting one exit-duration before removal', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast('Saved', 'checkmark-circle-outline'); });

    advance(TOTAL_DURATION - EXIT_DURATION);

    expect(result.current.toasts[0].exiting).toBe(true);
  });

  it('is gone at the full duration', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast('Saved', 'checkmark-circle-outline'); });

    advance(TOTAL_DURATION);

    expect(result.current.toasts).toEqual([]);
  });

  it('expires each toast on its own schedule', () => {
    const { result } = renderToasts();

    act(() => { result.current.showToast('first', 'checkmark-circle-outline'); });
    advance(1000);
    act(() => { result.current.showToast('second', 'trash-outline'); });

    advance(TOTAL_DURATION - 1000);
    expect(result.current.toasts.map(t => t.text)).toEqual(['second']);

    advance(1000);
    expect(result.current.toasts).toEqual([]);
  });
});

describe('sticky toasts', () => {
  // A sticky toast reports a failure the user has to act on, so it must survive
  // indefinitely rather than scrolling past.
  it('never expires on its own', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast('Save failed', 'close-circle-outline', { sticky: true }); });

    advance(TOTAL_DURATION * 100);

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].exiting).toBe(false);
  });

  it('does not schedule any timers', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast('Save failed', 'close-circle-outline', { sticky: true }); });

    expect(jest.getTimerCount()).toBe(0);
  });

  it('coexists with an auto-dismissing toast', () => {
    const { result } = renderToasts();

    act(() => {
      result.current.showToast('Save failed', 'close-circle-outline', { sticky: true });
      result.current.showToast('Saved', 'checkmark-circle-outline');
    });
    advance(TOTAL_DURATION);

    expect(result.current.toasts.map(t => t.text)).toEqual(['Save failed']);
  });
});

describe('dismissToast', () => {
  it('runs the exit animation before removing', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast('Saved', 'checkmark-circle-outline'); });

    act(() => { result.current.dismissToast(0); });
    expect(result.current.toasts[0].exiting).toBe(true);

    advance(EXIT_DURATION);
    expect(result.current.toasts).toEqual([]);
  });

  it('dismisses a sticky toast, which nothing else would', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast('Save failed', 'close-circle-outline', { sticky: true }); });

    act(() => { result.current.dismissToast(0); });
    advance(EXIT_DURATION);

    expect(result.current.toasts).toEqual([]);
  });

  it('leaves other toasts alone', () => {
    const { result } = renderToasts();
    act(() => {
      result.current.showToast('first', 'checkmark-circle-outline');
      result.current.showToast('second', 'trash-outline');
    });

    act(() => { result.current.dismissToast(0); });
    advance(EXIT_DURATION);

    expect(result.current.toasts.map(t => t.text)).toEqual(['second']);
  });

  it('is harmless for an id that is not present', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast('Saved', 'checkmark-circle-outline'); });

    act(() => { result.current.dismissToast(999); });

    expect(result.current.toasts).toHaveLength(1);
  });

  /*
   * TODO(bug): dismissToast clears the two scheduled timers and then calls
   * remove(), which schedules a third EXIT_DURATION timer that is never recorded
   * in the timers map. It is harmless today because the callback filters by id
   * and is idempotent, but the map entry it deletes may already be gone.
   * Pinned as-is: an untracked timer survives the dismissal.
   */
  it('leaves one untracked timer behind after dismissal', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast('Saved', 'checkmark-circle-outline'); });

    act(() => { result.current.dismissToast(0); });

    expect(jest.getTimerCount()).toBe(1);
  });
});

describe('dismissStickyToasts', () => {
  it('dismisses every sticky toast', () => {
    const { result } = renderToasts();
    act(() => {
      result.current.showToast('a', 'close-circle-outline', { sticky: true });
      result.current.showToast('b', 'close-circle-outline', { sticky: true });
    });

    act(() => { result.current.dismissStickyToasts(); });
    advance(EXIT_DURATION);

    expect(result.current.toasts).toEqual([]);
  });

  // Non-sticky toasts are already on their way out, so sweeping them too would
  // cut short a toast the user is still reading.
  it('leaves non-sticky toasts running', () => {
    const { result } = renderToasts();
    act(() => {
      result.current.showToast('sticky', 'close-circle-outline', { sticky: true });
      result.current.showToast('transient', 'checkmark-circle-outline');
    });

    act(() => { result.current.dismissStickyToasts(); });
    advance(EXIT_DURATION);

    expect(result.current.toasts.map(t => t.text)).toEqual(['transient']);
  });

  it('does nothing when there are no sticky toasts', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast('transient', 'checkmark-circle-outline'); });

    act(() => { result.current.dismissStickyToasts(); });

    expect(result.current.toasts).toHaveLength(1);
  });

  it('is harmless with no toasts at all', () => {
    const { result } = renderToasts();

    expect(() => act(() => { result.current.dismissStickyToasts(); })).not.toThrow();
  });
});
