import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QueryFilterListbox from '@/components/ui/filters/QueryFilterListbox';

const replace = jest.fn();
let search = '';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/runs',
  useSearchParams: () => new URLSearchParams(search),
}));

const OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'running', label: 'Running' },
  { value: 'failed', label: 'Failed' },
];

beforeEach(() => {
  replace.mockClear();
  search = '';
});

const choose = async (label: string, value = 'all') => {
  const user = userEvent.setup();
  render(<QueryFilterListbox id="status" name="status" options={OPTIONS} value={value} />);
  await user.click(screen.getByRole('combobox'));
  await user.click(screen.getByRole('option', { name: label }));
};

describe('QueryFilterListbox', () => {
  it('writes the chosen value to the URL without scrolling', async () => {
    await choose('Failed');

    expect(replace).toHaveBeenCalledWith('/runs?status=failed', { scroll: false });
  });

  it('keeps the other params already in the URL', async () => {
    search = 'trigger=webhook&id=run-1';

    await choose('Running');

    expect(replace).toHaveBeenCalledWith('/runs?trigger=webhook&id=run-1&status=running', { scroll: false });
  });

  it('removes the param when the default option is chosen', async () => {
    search = 'status=failed&trigger=webhook';

    await choose('All statuses', 'failed');

    expect(replace).toHaveBeenCalledWith('/runs?trigger=webhook', { scroll: false });
  });

  it('leaves a bare pathname when no params remain', async () => {
    search = 'status=failed';

    await choose('All statuses', 'failed');

    expect(replace).toHaveBeenCalledWith('/runs', { scroll: false });
  });

  it('shows the server-parsed value on the trigger', () => {
    render(<QueryFilterListbox id="status" name="status" options={OPTIONS} value="running" />);

    expect(within(screen.getByRole('combobox')).getByText('Running')).toBeInTheDocument();
  });
});
