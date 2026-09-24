import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WebhookCardShell from '@/components/webhooks/WebhookCardShell';

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

const setup = () =>
  render(<WebhookCardShell id="wh-1"><span>card body</span></WebhookCardShell>);

/*
 * The shell is what makes a webhook card clickable: it opens the webhook modal by pushing
 * ?id=, and /webhooks keeps its filters in the same query string — so the push adds the id
 * to what is there rather than replacing it.
 */
describe('opening the webhook', () => {
  it('pushes the webhook id onto /webhooks', async () => {
    setup();

    await userEvent.click(screen.getByText('card body'));

    expect(mockPush).toHaveBeenCalledWith('/webhooks?id=wh-1');
  });

  it('keeps the filters already in the URL', async () => {
    mockSearch = 'active=inactive&recency=least-recent';
    setup();

    await userEvent.click(screen.getByText('card body'));

    expect(mockPush).toHaveBeenCalledWith('/webhooks?active=inactive&recency=least-recent&id=wh-1');
  });

  it('drops a leftover mode', async () => {
    mockSearch = 'active=inactive&mode=create';
    setup();

    await userEvent.click(screen.getByText('card body'));

    expect(mockPush).toHaveBeenCalledWith('/webhooks?active=inactive&id=wh-1');
  });
});
