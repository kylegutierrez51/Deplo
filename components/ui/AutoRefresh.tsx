"use client"

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/*
==============================================================================================
 * Re-runs the enclosing server component on a timer. Renders nothing.
 *
 * Pages that display state someone else owns have no push channel to update from, and
 * revalidatePath is not one. revalidatePath is request-scoped, not global. 
 * It writes to an AsyncLocalStorage store that only exists while Next is handling a request, 
 * and its effect is delivered in the response to that request. 
 * The runner has neither, so the call throws.
 * even in the app process it can only refresh the tab that called it, 
 * which is why polling is required regardless of which process writes the row
 *
 * Polling is therefore the only option, and router.refresh() is the right lever for it —
 * it re-executes the server component and reconciles the result into the existing tree,
 * so client state, focus and scroll position all survive.
 *
 * `enabled` exists for pages that reach a terminal state and should stop paying for it,
 * such as a run that has finished. A page showing a queue has no such state — a new item
 * can arrive at any time — and simply leaves it on.
==============================================================================================
*/
interface AutoRefreshProps {
  intervalMs: number;
  enabled?: boolean;
}

export default function AutoRefresh({ intervalMs, enabled = true }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    // A hidden tab has nobody to show the new data to. Without this check, a page left
    // open overnight re-queries Postgres until morning on behalf of no one.
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };

    const timer = setInterval(refreshIfVisible, intervalMs);

    document.addEventListener('visibilitychange', refreshIfVisible);

    // runs immediately before component unmounts and before every re-run of the effect, which keeps duplicate event listeners and timers from accumulating. Remember, router.refresh() re-renders the component.
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [router, intervalMs, enabled]);

  return null;
}

/*
"visibilitychange" gives access to "document.visibilityState", 
which can either be "hidden" or "visible". 
If it's hidden, then the user is in a different tab. 
When visible, the user is on the tab that this component is mounted on. 
We only refresh when the tab is 'visible' (in refreshIfVisible)
*/