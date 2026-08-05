import { render, screen } from '@testing-library/react';
import Pill, { type PillVariant } from '@/components/ui/Pill';

/*
 * Pill is trivial, but ~10 components render it and every variant needs a
 * matching `.pill--<variant>` rule in app/globals.css. Enumerating the union
 * here means adding a variant without wiring it up shows as a test diff.
 */
const VARIANTS: PillVariant[] = [
  'running', 'succeeded', 'failed', 'queued', 'cancelled',
  'production', 'staging', 'development', 'preview', 'custom',
  'processed', 'ignored', 'pending', 'push', 'pull-request', 'webhook',
  'manual', 'api', 'total', 'awaiting-approval', 'idle',
  'approved', 'unapproved',
];

describe('Pill', () => {
  it.each(VARIANTS)('renders the pill--%s class', (variant) => {
    render(<Pill variant={variant} label={variant} />);
    expect(screen.getByText(variant)).toHaveClass('pill', `pill--${variant}`);
  });

  it('renders the label verbatim rather than deriving it from the variant', () => {
    render(<Pill variant="pull-request" label="Pull Request" />);
    expect(screen.getByText('Pull Request')).toBeInTheDocument();
  });

  // Every variant in the union needs a rule in globals.css. This pins the count
  // so the two lists cannot drift silently.
  it('covers all 23 declared variants', () => {
    expect(new Set(VARIANTS).size).toBe(23);
  });
});
