import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'node:util';

/*
 * jsdom ships neither, but plenty of code reachable from a component import does
 * (Next's stream helpers, pg's SASL auth). Node has both — hand them over rather
 * than let an unrelated transitive import fail the suite.
 */
global.TextEncoder ??= TextEncoder;
global.TextDecoder ??= TextDecoder as typeof global.TextDecoder;

/*
 * Everything below patches the DOM, so it only applies under jsdom. A file that opts
 * into `@jest-environment node` — runner/execute.test.ts, which spawns real processes —
 * has no Element to patch, and this file runs for it too.
 */
if (typeof window !== 'undefined') {
  /*
   * jsdom implements neither of these, and @xyflow/react measures its container
   * on mount. Without the stubs, any test that renders a ReactFlow subtree throws
   * before a single assertion runs.
   */
  global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
  };

  // jsdom reports every element as 0x0. ReactFlow treats a zero-sized pane as
  // unmeasured and refuses to render nodes, so give it a plausible viewport.
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
    return {
      x: 0, y: 0, top: 0, left: 0, right: 1024, bottom: 768,
      width: 1024, height: 768,
      toJSON: () => ({}),
    } as DOMRect;
  };

  /*
   * jsdom does no layout, so it implements no scrolling method at all — the property
   * is absent rather than a no-op, and `?.` does not help because the object it is
   * called on exists. FilterListbox calls it to keep its active row in view. Defined
   * on the prototype so a test that cares can jest.spyOn it.
   */
  Element.prototype.scrollIntoView = function scrollIntoView() { };

  // @xyflow/react calls this on nodes it is about to transform.
  if (!global.DOMMatrixReadOnly) {
    // @ts-expect-error — minimal stand-in, only the fields ReactFlow reads.
    global.DOMMatrixReadOnly = class DOMMatrixReadOnly {
      m22 = 1;
      constructor(_transform?: string) { }
    };
  }
}
