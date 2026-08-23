import { act, renderHook } from '@testing-library/react';
import { ToastProvider, useToast } from '@/components/ui/toast/ToastContext';

/*
 * A timer state machine, so everything here runs on fake timers. The two
 * constants it is built around are TOTAL_DURATION 3000 and EXIT_DURATION 200:
 * a toast flips to `exiting` at 2800 to run its animation, then leaves at 3000.
 *
 * TOTAL_DURATION is the default rather than the rule -- a caller can buy its
 * reader more time through the totalDuration option. EXIT_DURATION is not
 * negotiable, since it has to match the CSS animation in toast.module.css.
 */

const TOTAL_DURATION = 3000;
const EXIT_DURATION = 200;

// An explicit factory rather than a bare jest.mock: automocking next/navigation
// loads the real module to introspect it and drags in Next's server runtime.
let mockPathname = '/pipelines/p1';
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));

const renderToasts = () => renderHook(() => useToast(), { wrapper: ToastProvider });

const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

// usePathname reads the module-level value, so moving it and re-rendering is
// what a client-side navigation looks like from inside the provider.
const navigateTo = (pathname: string, rerender: () => void) => {
  mockPathname = pathname;
  rerender();
};

beforeEach(() => { jest.useFakeTimers(); mockPathname = '/pipelines/p1'; });
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

    act(() => { result.current.showToast({ text: 'Saved', icon: 'checkmark-circle-outline' }); });

    expect(result.current.toasts).toEqual([
      { id: 0, text: 'Saved', icon: 'checkmark-circle-outline', exiting: false, sticky: false },
    ]);
  });

  it('gives each toast a monotonically increasing id', () => {
    const { result } = renderToasts();

    act(() => {
      result.current.showToast({ text: 'one', icon: 'checkmark-circle-outline' });
      result.current.showToast({ text: 'two', icon: 'trash-outline' });
    });

    expect(result.current.toasts.map(t => t.id)).toEqual([0, 1]);
  });

  it('stacks toasts in the order they were raised', () => {
    const { result } = renderToasts();

    act(() => {
      result.current.showToast({ text: 'first', icon: 'checkmark-circle-outline' });
      result.current.showToast({ text: 'second', icon: 'trash-outline' });
    });

    expect(result.current.toasts.map(t => t.text)).toEqual(['first', 'second']);
  });
});

/*
 * Toast.tsx renders its open-outline anchor only when `link` is present, so the field is
 * not merely a value being carried through -- it decides whether an element exists in the
 * row at all. The provider never reads it, which is exactly why nothing else would notice
 * it being dropped: a toast with no link is a valid toast, so losing one silently costs
 * the user the only route from "Pipeline Run Triggered!" to the run it triggered.
 */
describe('link', () => {
  const showLinked = (result: { current: ReturnType<typeof useToast> }) =>
    act(() => {
      result.current.showToast({
        text: 'Pipeline Run Triggered!',
        icon: 'checkmark-circle-outline',
        link: '/runs/run-1',
      });
    });

  it('carries the link onto the toast it was raised with', () => {
    const { result } = renderToasts();
    showLinked(result);

    expect(result.current.toasts[0].link).toBe('/runs/run-1');
  });

  // Asserted on the field rather than through toEqual on the whole toast, which treats an
  // undefined property as absent and would pass just as happily on a link that was set.
  it('leaves the link undefined when none is given', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast({ text: 'Saved', icon: 'checkmark-circle-outline' }); });

    expect(result.current.toasts[0].link).toBeUndefined();
  });

  it('gives the link to that toast alone', () => {
    const { result } = renderToasts();
    showLinked(result);
    act(() => { result.current.showToast({ text: 'Saved', icon: 'checkmark-circle-outline' }); });

    expect(result.current.toasts.map(t => t.link)).toEqual(['/runs/run-1', undefined]);
  });

  /*
   * `remove` rebuilds the toast to flip `exiting`, and a spread that lost the link would
   * drop the anchor out of the row mid-animation -- the element vanishing from under a
   * cursor already reaching for it, in the two hundred milliseconds it is still clickable.
   */
  it('keeps the link through the exit animation', () => {
    const { result } = renderToasts();
    showLinked(result);

    advance(TOTAL_DURATION - EXIT_DURATION);

    expect(result.current.toasts[0]).toMatchObject({ exiting: true, link: '/runs/run-1' });
  });

  // The one linked toast in the app is sticky as well, which makes it easy to read the
  // link as the thing holding it open. It is not: a link buys no time on its own.
  it('does not hold the toast open', () => {
    const { result } = renderToasts();
    showLinked(result);

    advance(TOTAL_DURATION);

    expect(result.current.toasts).toEqual([]);
  });
});

describe('auto dismissal', () => {
  it('is still fully visible just before the exit animation starts', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast({ text: 'Saved', icon: 'checkmark-circle-outline' }); });

    advance(TOTAL_DURATION - EXIT_DURATION - 1);

    expect(result.current.toasts[0].exiting).toBe(false);
  });

  it('flips to exiting one exit-duration before removal', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast({ text: 'Saved', icon: 'checkmark-circle-outline' }); });

    advance(TOTAL_DURATION - EXIT_DURATION);

    expect(result.current.toasts[0].exiting).toBe(true);
  });

  it('is gone at the full duration', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast({ text: 'Saved', icon: 'checkmark-circle-outline' }); });

    advance(TOTAL_DURATION);

    expect(result.current.toasts).toEqual([]);
  });

  it('expires each toast on its own schedule', () => {
    const { result } = renderToasts();

    act(() => { result.current.showToast({ text: 'first', icon: 'checkmark-circle-outline' }); });
    advance(1000);
    act(() => { result.current.showToast({ text: 'second', icon: 'trash-outline' }); });

    advance(TOTAL_DURATION - 1000);
    expect(result.current.toasts.map(t => t.text)).toEqual(['second']);

    advance(1000);
    expect(result.current.toasts).toEqual([]);
  });
});

/*
 * Not every toast is the same length of read. "Saved" is a glance; the approval that
 * lost its race has a sentence to deliver about a run that ended underneath the card,
 * and three seconds is not enough to take that in before it vanishes. totalDuration
 * buys that reader time without reaching for sticky, which would leave behind a ✕ they
 * have to clear for news that stops mattering the moment it is read.
 */
describe('totalDuration', () => {
  // Deliberately not a multiple of the default, so nothing here can pass on arithmetic
  // that still has TOTAL_DURATION in it.
  const LONG = 8000;

  const showLong = (result: { current: ReturnType<typeof useToast> }, text = 'Run cancelled') =>
    act(() => {
      result.current.showToast({
        text,
        icon: 'close-circle-outline',
        options: { totalDuration: LONG },
      });
    });

  it('is untouched at the moment the default would have taken it', () => {
    const { result } = renderToasts();
    showLong(result);

    advance(TOTAL_DURATION);

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].exiting).toBe(false);
  });

  // The exit animation is measured back from the duration it was given, not forward
  // from the default -- otherwise a long toast would sit in `exiting` for five seconds.
  it('flips to exiting one exit-duration before the duration it was given', () => {
    const { result } = renderToasts();
    showLong(result);

    advance(LONG - EXIT_DURATION);

    expect(result.current.toasts[0].exiting).toBe(true);
  });

  it('is gone at the duration it was given', () => {
    const { result } = renderToasts();
    showLong(result);

    advance(LONG);

    expect(result.current.toasts).toEqual([]);
  });

  // Per call, not a mode: a toast raised beside a long one keeps the default.
  it('leaves every other toast on its own schedule', () => {
    const { result } = renderToasts();
    showLong(result, 'long');
    act(() => { result.current.showToast({ text: 'short', icon: 'checkmark-circle-outline' }); });

    advance(TOTAL_DURATION);
    expect(result.current.toasts.map(t => t.text)).toEqual(['long']);

    advance(LONG - TOTAL_DURATION);
    expect(result.current.toasts).toEqual([]);
  });

  // An options object that says nothing about duration is not a duration of zero, which
  // is what reading the option without a `??` would make of it.
  it('falls back to the default when options carry no duration', () => {
    const { result } = renderToasts();
    act(() => {
      result.current.showToast({
        text: 'Saved',
        icon: 'checkmark-circle-outline',
        options: { sticky: false },
      });
    });

    advance(TOTAL_DURATION);

    expect(result.current.toasts).toEqual([]);
  });

  /*
   * sticky returns before any timer is scheduled, so the two options cannot both apply
   * and sticky is the one that wins. It has to be: the ✕ is the only thing meant to
   * remove that toast, and a duration quietly expiring it would take the report away
   * from a user who never acknowledged it.
   */
  it('is ignored by a sticky toast rather than expiring it late', () => {
    const { result } = renderToasts();
    act(() => {
      result.current.showToast({
        text: 'Save failed',
        icon: 'close-circle-outline',
        options: { sticky: true, totalDuration: LONG },
      });
    });

    advance(LONG * 2);

    expect(result.current.toasts).toHaveLength(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('sticky toasts', () => {
  // A sticky toast reports a failure the user has to act on, so it must survive
  // indefinitely rather than scrolling past.
  it('never expires on its own', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast({ text: 'Save failed', icon: 'close-circle-outline', options: { sticky: true } }); });

    advance(TOTAL_DURATION * 100);

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].exiting).toBe(false);
  });

  it('does not schedule any timers', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast({ text: 'Save failed', icon: 'close-circle-outline', options: { sticky: true } }); });

    expect(jest.getTimerCount()).toBe(0);
  });

  it('coexists with an auto-dismissing toast', () => {
    const { result } = renderToasts();

    act(() => {
      result.current.showToast({ text: 'Save failed', icon: 'close-circle-outline', options: { sticky: true } });
      result.current.showToast({ text: 'Saved', icon: 'checkmark-circle-outline' });
    });
    advance(TOTAL_DURATION);

    expect(result.current.toasts.map(t => t.text)).toEqual(['Save failed']);
  });
});

describe('dismissToast', () => {
  it('runs the exit animation before removing', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast({ text: 'Saved', icon: 'checkmark-circle-outline' }); });

    act(() => { result.current.dismissToast(0); });
    expect(result.current.toasts[0].exiting).toBe(true);

    advance(EXIT_DURATION);
    expect(result.current.toasts).toEqual([]);
  });

  it('dismisses a sticky toast, which nothing else would', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast({ text: 'Save failed', icon: 'close-circle-outline', options: { sticky: true } }); });

    act(() => { result.current.dismissToast(0); });
    advance(EXIT_DURATION);

    expect(result.current.toasts).toEqual([]);
  });

  it('leaves other toasts alone', () => {
    const { result } = renderToasts();
    act(() => {
      result.current.showToast({ text: 'first', icon: 'checkmark-circle-outline' });
      result.current.showToast({ text: 'second', icon: 'trash-outline' });
    });

    act(() => { result.current.dismissToast(0); });
    advance(EXIT_DURATION);

    expect(result.current.toasts.map(t => t.text)).toEqual(['second']);
  });

  it('is harmless for an id that is not present', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast({ text: 'Saved', icon: 'checkmark-circle-outline' }); });

    act(() => { result.current.dismissToast(999); });

    expect(result.current.toasts).toHaveLength(1);
  });

  it('schedules exactly one exit timer', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast({ text: 'Saved', icon: 'checkmark-circle-outline' }); });

    act(() => { result.current.dismissToast(0); });

    expect(jest.getTimerCount()).toBe(1);
  });

  /*
   * The ✕ stays clickable while the exit animation plays, so a second dismissal
   * can land inside that window. It has to cancel the exit timer the first one
   * scheduled, which means every timer must be recorded in the timers map --
   * dismissToast can only clear what it can find there.
   */
  it('does not schedule a second exit timer when dismissed twice', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast({ text: 'Save failed', icon: 'close-circle-outline', options: { sticky: true } }); });

    act(() => { result.current.dismissToast(0); });
    advance(EXIT_DURATION / 2);
    act(() => { result.current.dismissToast(0); });

    expect(jest.getTimerCount()).toBe(1);
  });
});

describe('dismissStickyToasts', () => {
  it('dismisses every sticky toast', () => {
    const { result } = renderToasts();
    act(() => {
      result.current.showToast({ text: 'a', icon: 'close-circle-outline', options: { sticky: true } });
      result.current.showToast({ text: 'b', icon: 'close-circle-outline', options: { sticky: true } });
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
      result.current.showToast({ text: 'sticky', icon: 'close-circle-outline', options: { sticky: true } });
      result.current.showToast({ text: 'transient', icon: 'checkmark-circle-outline' });
    });

    act(() => { result.current.dismissStickyToasts(); });
    advance(EXIT_DURATION);

    expect(result.current.toasts.map(t => t.text)).toEqual(['transient']);
  });

  it('does nothing when there are no sticky toasts', () => {
    const { result } = renderToasts();
    act(() => { result.current.showToast({ text: 'transient', icon: 'checkmark-circle-outline' }); });

    act(() => { result.current.dismissStickyToasts(); });

    expect(result.current.toasts).toHaveLength(1);
  });

  it('is harmless with no toasts at all', () => {
    const { result } = renderToasts();

    expect(() => act(() => { result.current.dismissStickyToasts(); })).not.toThrow();
  });
});

/*
 * A sticky toast reports on work the user started on this page, so it stops
 * making sense once they leave. The provider sits above the route in
 * providers.tsx and therefore survives navigation, which is exactly why it has
 * to clear these itself.
 */
describe('navigation', () => {
  it('dismisses a sticky toast when the pathname changes', () => {
    const { result, rerender } = renderToasts();
    act(() => { result.current.showToast({ text: 'Run failed', icon: 'close-circle-outline', options: { sticky: true } }); });

    navigateTo('/runs/run-1', rerender);

    // No advance() first: the exit animation would otherwise play out on the
    // page the user just landed on, which reads as a glitch rather than a
    // dismissal, so the toast goes immediately.
    expect(result.current.toasts).toEqual([]);
  });

  it('keeps a sticky toast when the pathname is unchanged', () => {
    const { result, rerender } = renderToasts();
    act(() => { result.current.showToast({ text: 'Run failed', icon: 'close-circle-outline', options: { sticky: true } }); });

    // The ?id=&mode= modals push a new URL without changing the pathname, so a
    // re-render on the same path must leave the report standing.
    navigateTo('/pipelines/p1', rerender);

    expect(result.current.toasts).toHaveLength(1);
  });

  it('dismisses every sticky toast at once', () => {
    const { result, rerender } = renderToasts();
    act(() => {
      result.current.showToast({ text: 'a', icon: 'close-circle-outline', options: { sticky: true } });
      result.current.showToast({ text: 'b', icon: 'close-circle-outline', options: { sticky: true } });
    });

    navigateTo('/runs/run-1', rerender);

    expect(result.current.toasts).toEqual([]);
  });

  it('leaves a non-sticky toast running, still on its own schedule', () => {
    const { result, rerender } = renderToasts();
    act(() => { result.current.showToast({ text: 'Saved', icon: 'checkmark-circle-outline' }); });

    navigateTo('/runs/run-1', rerender);
    expect(result.current.toasts.map(t => t.text)).toEqual(['Saved']);

    advance(TOTAL_DURATION);
    expect(result.current.toasts).toEqual([]);
  });

  /*
   * Navigating during the exit animation leaves that removal timer pending
   * against a toast the navigation already dropped. Clearing it eagerly would
   * mean calling clearTimeout during render, and a render React discards would
   * then strand a dismissed toast in `exiting` forever -- so the timer is left
   * to drain instead, and what matters is that draining is inert.
   */
  it('lets the exit timer of a toast dismissed just before navigating drain harmlessly', () => {
    const { result, rerender } = renderToasts();
    act(() => { result.current.showToast({ text: 'Run failed', icon: 'close-circle-outline', options: { sticky: true } }); });
    act(() => { result.current.dismissToast(0); });

    navigateTo('/runs/run-1', rerender);
    expect(result.current.toasts).toEqual([]);

    advance(EXIT_DURATION);

    expect(result.current.toasts).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });
});
