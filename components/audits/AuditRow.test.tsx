import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuditRow from '@/components/audits/AuditRow';
import type { Audit } from '@/lib/data/audits';

/*
 * lib/data/audits is imported for its type only, but Jest still loads the module and it
 * pulls in the Prisma singleton, which opens a pg connection at module scope.
 */
jest.mock('@/lib/prisma');

/*
 * mock-prefixed so the hoisted factory may close over them; both are read at render or
 * click time, after the module body has run.
 */
const mockPush = jest.fn();
let mockSearch = '';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockSearch = '';
});

const audit = (over: Partial<Audit> = {}): Audit => ({
  id: 'aud-1',
  userId: null,
  user: 'kyle',
  actor: 'kyle',
  action: 'Pipeline Created',
  resourceType: 'pipeline',
  resourceId: 'p1',
  resourceLabel: 'CI',
  resourceMeta: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

const setup = (over: Partial<Audit> = {}) =>
  render(<table><tbody><AuditRow audit={audit(over)} /></tbody></table>);

/*
 * The row opens the audit modal by pushing ?id=, and /audits keeps its filters in the same
 * query string — so the push adds the id to what is there rather than replacing it.
 */
describe('opening the audit entry', () => {
  it('pushes the audit id onto /audits', async () => {
    setup();

    await userEvent.click(screen.getByText('kyle'));

    expect(mockPush).toHaveBeenCalledWith('/audits?id=aud-1');
  });

  it('keeps the filters already in the URL', async () => {
    mockSearch = 'resource=pipeline&range=30days&recency=least-recent';
    setup();

    await userEvent.click(screen.getByText('kyle'));

    expect(mockPush).toHaveBeenCalledWith('/audits?resource=pipeline&range=30days&recency=least-recent&id=aud-1');
  });

  // The resource link opens in a new tab; it must not also open the modal behind it.
  it('does not open the modal when the resource link is clicked', async () => {
    setup();

    await userEvent.click(screen.getByRole('link', { name: 'Open resource' }));

    expect(mockPush).not.toHaveBeenCalled();
  });
});
