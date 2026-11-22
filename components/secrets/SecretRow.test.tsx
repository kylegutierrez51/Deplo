import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SecretRow from '@/components/secrets/SecretRow';
import type { Secret } from '@/lib/data/secrets';

/*
 * lib/data/secrets is imported for its type only, but Jest still loads the module and it
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

const secret = (over: Partial<Secret> = {}): Secret => ({
  id: 'sec-1',
  key: 'API_KEY',
  notes: null,
  environmentId: 'env-1',
  environment: { name: 'Production', type: 'production' },
  createdById: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

const setup = (over: Partial<Secret> = {}) =>
  render(<table><tbody><SecretRow secret={secret(over)} /></tbody></table>);

/*
 * The row opens the secret modal by pushing ?id=, and /secrets keeps its filter in the
 * same query string — so the push adds the id to what is there rather than replacing it.
 */
describe('opening the secret', () => {
  it('pushes the secret id onto /secrets', async () => {
    setup();

    await userEvent.click(screen.getByText('API_KEY'));

    expect(mockPush).toHaveBeenCalledWith('/secrets?id=sec-1');
  });

  it('keeps the filter already in the URL', async () => {
    mockSearch = 'environment=production';
    setup();

    await userEvent.click(screen.getByText('API_KEY'));

    expect(mockPush).toHaveBeenCalledWith('/secrets?environment=production&id=sec-1');
  });

  it('drops a leftover mode', async () => {
    mockSearch = 'environment=production&mode=create';
    setup();

    await userEvent.click(screen.getByText('API_KEY'));

    expect(mockPush).toHaveBeenCalledWith('/secrets?environment=production&id=sec-1');
  });
});


describe('row details and accessibility', () => {
  it('keeps the existing details in all 3 cells', () => {
    setup({ notes: 'Used by the release pipeline' });
    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(3);
    expect(cells[0]).toHaveTextContent('API_KEY');
    expect(cells[0]).toHaveTextContent('Used by the release pipeline');
    expect(cells[1]).toHaveTextContent('Production');
    expect(cells[2]).toHaveTextContent('1/1/26, 00:00:00');
    expect(cells[2].querySelector('time')).toHaveAttribute('datetime', '2026-01-01T00:00:00.000Z');
  });

  it('opens the secret using the keyboard', async () => {
    setup();
    screen.getByRole('button', { name: 'API_KEY' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/secrets?id=sec-1');
  });
});
