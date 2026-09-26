import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from '@/components/ui/pagination/Pagination';

let search = '';
const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/runs',
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  search = '';
  push.mockClear();
});

const renderAt = (page: number, total = 220) =>
  render(<Pagination page={page} pageCount={Math.ceil(total / 10)} total={total} pageSize={10} />);

const hrefOf = (name: string | RegExp) => screen.getByRole('link', { name }).getAttribute('href');

describe('Pagination', () => {
  it('reports the rows on this page out of the total', () => {
    renderAt(9);

    expect(screen.getByText('Showing 81-90 of 220')).toBeInTheDocument();
  });

  it('stops the range at the total on a partial last page', () => {
    renderAt(3, 25);

    expect(screen.getByText('Showing 21-25 of 25')).toBeInTheDocument();
  });

  it('marks the current page and does not link it', () => {
    renderAt(9);

    expect(screen.getByText('9')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Page 9' })).not.toBeInTheDocument();
  });

  it('links the neighbours, the ends and nothing between', () => {
    renderAt(9);

    const pages = screen.getAllByRole('link', { name: /^Page / }).map((link) => link.textContent);
    expect(pages).toEqual(['1', '8', '10', '22']);
    expect(screen.getAllByText('...')).toHaveLength(2);
  });

  it('keeps the filters in the URL and swaps only the page', () => {
    search = 'status=failed&page=9';
    renderAt(9);

    expect(hrefOf('Page 10')).toBe('/runs?status=failed&page=10');
  });

  // Page 1 is the default, so it leaves the URL the way choosing a default filter does.
  it('drops the param rather than writing page=1', () => {
    search = 'status=failed&page=2';
    renderAt(2);

    expect(hrefOf('Page 1')).toBe('/runs?status=failed');
    expect(hrefOf(/Prev/)).toBe('/runs?status=failed');
  });

  it('does not carry an open modal to another page', () => {
    search = 'id=run-1&mode=view&page=2';
    renderAt(2);

    expect(hrefOf('Page 3')).toBe('/runs?page=3');
  });

  it('disables Prev on the first page', () => {
    renderAt(1, 30);

    expect(screen.queryByRole('link', { name: /Prev/ })).not.toBeInTheDocument();
    expect(screen.getByText('Prev').parentElement).toHaveAttribute('aria-disabled', 'true');
    expect(hrefOf(/Next/)).toBe('/runs?page=2');
  });

  it('disables Next on the last page', () => {
    renderAt(3, 30);

    expect(screen.queryByRole('link', { name: /Next/ })).not.toBeInTheDocument();
    expect(screen.getByText('Next').parentElement).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows no controls when everything fits on one page', () => {
    renderAt(1, 7);

    expect(screen.getByText('Showing 1-7 of 7')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});

describe('jumping to a page from an ellipsis', () => {
  // Page 9 of 22 renders two ellipses; the first sits between 1 and 8.
  const openJump = async () => {
    const user = userEvent.setup();
    search = 'status=failed&page=9';
    renderAt(9);
    await user.click(screen.getAllByRole('button', { name: 'Jump to page' })[0]);
    return user;
  };

  const input = () => screen.getByRole('textbox', { name: 'Go to page (1-22)' });

  it('turns the ellipsis into a focused input', async () => {
    await openJump();

    expect(input()).toHaveFocus();
  });

  it('goes to the typed page on Enter, keeping the filters', async () => {
    const user = await openJump();

    await user.type(input(), '15{Enter}');

    expect(push).toHaveBeenCalledWith('/runs?status=failed&page=15');
  });

  it('goes to the last page for a number past the end', async () => {
    const user = await openJump();

    await user.type(input(), '500{Enter}');

    expect(push).toHaveBeenCalledWith('/runs?status=failed&page=22');
  });

  it('accepts only digits', async () => {
    const user = await openJump();

    await user.type(input(), '1a-2');

    expect(input()).toHaveValue('12');
  });

  it.each([
    ['nothing', '{Enter}'],
    ['zero', '0{Enter}'],
    ['the current page', '9{Enter}'],
  ])('does not navigate for %s', async (_case, keys) => {
    const user = await openJump();

    await user.type(input(), keys);

    expect(push).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button', { name: 'Jump to page' })).toHaveLength(2);
  });

  it('puts the ellipsis back on Escape without navigating', async () => {
    const user = await openJump();

    await user.type(input(), '15{Escape}');

    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('puts the ellipsis back when focus leaves', async () => {
    const user = await openJump();

    await user.type(input(), '15');
    await user.click(document.body);

    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
