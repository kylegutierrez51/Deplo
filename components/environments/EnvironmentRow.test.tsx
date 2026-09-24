import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EnvironmentRow from '@/components/environments/EnvironmentRow';
import type { Environment } from '@/lib/data/environments';

/*
 * lib/data/environments is imported for its type only, but Jest still loads the module and
 * it pulls in the Prisma singleton, which opens a pg connection at module scope.
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

const env = (over: Partial<Environment> = {}): Environment => ({
  id: 'env-1',
  name: 'prod-us-east',
  type: 'production',
  requireApproval: true,
  secrets: 2,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

const setup = (over: Partial<Environment> = {}) =>
  render(<table><tbody><EnvironmentRow env={env(over)} /></tbody></table>);

/*
 * The row opens the environment modal by pushing ?id=, and /environments keeps its filters
 * in the same query string — so the push adds the id to what is there rather than
 * replacing it.
 */
describe('opening the environment', () => {
  it('pushes the environment id onto /environments', async () => {
    setup();

    await userEvent.click(screen.getByText('prod-us-east'));

    expect(mockPush).toHaveBeenCalledWith('/environments?id=env-1');
  });

  it('keeps the filters already in the URL', async () => {
    mockSearch = 'environment=production&updated=7days';
    setup();

    await userEvent.click(screen.getByText('prod-us-east'));

    expect(mockPush).toHaveBeenCalledWith('/environments?environment=production&updated=7days&id=env-1');
  });

  it('drops a leftover mode', async () => {
    mockSearch = 'updated=7days&mode=create';
    setup();

    await userEvent.click(screen.getByText('prod-us-east'));

    expect(mockPush).toHaveBeenCalledWith('/environments?updated=7days&id=env-1');
  });
});
