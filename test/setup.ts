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

// @xyflow/react calls this on nodes it is about to transform.
if (!global.DOMMatrixReadOnly) {
  // @ts-expect-error — minimal stand-in, only the fields ReactFlow reads.
  global.DOMMatrixReadOnly = class DOMMatrixReadOnly {
    m22 = 1;
    constructor(_transform?: string) { }
  };
}
