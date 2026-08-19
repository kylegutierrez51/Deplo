import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterListbox, { type FilterListboxOption } from '@/components/ui/filters/FilterListbox';

/*
 * FilterListbox exists because a native <select> cannot show a Pill: the browser
 * draws the option list as an OS control from each option's textContent and
 * discards any markup inside it. So the assertions below are about the two things
 * that buys us — a real Pill per row — and the two things it costs us, which the
 * native control gave away for free: keyboard operation and a value that a form
 * can still submit under `name`.
 */

const OPTIONS = [
  { value: 'n1', label: 'checkout', status: 'succeeded' as const },
  { value: 'n2', label: 'build', status: 'running' as const },
  { value: 'n3', label: 'deploy', status: 'awaiting-approval' as const },
];

const noop = () => {};

const setup = (props: Partial<React.ComponentProps<typeof FilterListbox>> = {}) => {
  const user = userEvent.setup();
  render(
    <FilterListbox id="status" name="status" options={OPTIONS} setFilteredOption={noop} {...props} />,
  );
  return { user, trigger: screen.getByRole('combobox') };
};

const open = async () => {
  const { user, trigger } = setup();
  await user.click(trigger);
  return { user, trigger, listbox: screen.getByRole('listbox') };
};

describe('the pill per option', () => {
  it('renders a status pill on every row of the open list', async () => {
    const { listbox } = await open();

    const rows = within(listbox).getAllByRole('option');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('Succeeded')).toHaveClass('pill', 'pill--succeeded');
    expect(within(rows[1]).getByText('Running')).toHaveClass('pill', 'pill--running');
    expect(within(rows[2]).getByText('Awaiting')).toHaveClass('pill', 'pill--awaiting-approval');
  });

  it('renders each row label alongside its pill', async () => {
    const { listbox } = await open();

    const rows = within(listbox).getAllByRole('option');
    expect(within(rows[0]).getByText('checkout')).toBeInTheDocument();
    expect(within(rows[1]).getByText('build')).toBeInTheDocument();
  });

  it('shows the selected option label and pill on the collapsed trigger', () => {
    const { trigger } = setup({ defaultValue: 'n2' });

    expect(within(trigger).getByText('build')).toBeInTheDocument();
    expect(within(trigger).getByText('Running')).toHaveClass('pill--running');
  });

  it('omits the pill for an option with no status', async () => {
    const user = userEvent.setup();
    render(
      <FilterListbox
        id="status"
        name="status"
        options={[{ value: 'all', label: 'All stages' }]}
        setFilteredOption={noop}
      />,
    );
    await user.click(screen.getByRole('combobox'));

    const row = screen.getByRole('option');
    expect(within(row).getByText('All stages')).toBeInTheDocument();
    expect(row.querySelector('.pill')).toBeNull();
  });
});

describe('selection', () => {
  it('selects the first option when no defaultValue is given', () => {
    const { trigger } = setup();

    expect(within(trigger).getByText('checkout')).toBeInTheDocument();
  });

  it('submits the selected value under the given name', () => {
    setup({ defaultValue: 'n3' });

    expect(document.querySelector('input[type="hidden"][name="status"]')).toHaveValue('n3');
  });

  it('marks only the selected row aria-selected', async () => {
    const user = userEvent.setup();
    render(
      <FilterListbox
        id="status"
        name="status"
        options={OPTIONS}
        defaultValue="n2"
        setFilteredOption={noop}
      />,
    );
    await user.click(screen.getByRole('combobox'));

    const rows = screen.getAllByRole('option');
    expect(rows[0]).toHaveAttribute('aria-selected', 'false');
    expect(rows[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('commits the clicked option to the trigger and the hidden input', async () => {
    const { user, trigger, listbox } = await open();

    await user.click(within(listbox).getAllByRole('option')[2]);

    expect(within(trigger).getByText('deploy')).toBeInTheDocument();
    expect(document.querySelector('input[type="hidden"][name="status"]')).toHaveValue('n3');
  });

  it('reports the committed value to setFilteredOption', async () => {
    const setFilteredOption = jest.fn();
    const user = userEvent.setup();
    render(
      <FilterListbox
        id="status"
        name="status"
        options={OPTIONS}
        setFilteredOption={setFilteredOption}
      />,
    );
    await user.click(screen.getByRole('combobox'));

    await user.click(screen.getAllByRole('option')[2]);

    expect(setFilteredOption).toHaveBeenCalledTimes(1);
    expect(setFilteredOption).toHaveBeenCalledWith('n3');
  });

  it('closes the list once an option is clicked', async () => {
    const { user, listbox } = await open();

    await user.click(within(listbox).getAllByRole('option')[1]);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('opening and closing', () => {
  it('reports its expanded state on the trigger', async () => {
    const { user, trigger } = setup();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders no listbox until it is opened', () => {
    setup();

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes without changing the selection when a pointer lands outside', async () => {
    const { user, trigger } = await open();

    await user.click(document.body);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(within(trigger).getByText('checkout')).toBeInTheDocument();
  });

  it('closes and restores focus to the trigger on Escape', async () => {
    const { user, trigger } = await open();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe('keyboard operation', () => {
  it('opens on ArrowDown and makes the selected row active', async () => {
    const { user, trigger } = setup({ defaultValue: 'n2' });
    trigger.focus();

    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[1].id);
  });

  it('moves the active row with ArrowDown and ArrowUp', async () => {
    const { user, trigger } = await open();
    const rows = screen.getAllByRole('option');

    await user.keyboard('{ArrowDown}');
    expect(trigger).toHaveAttribute('aria-activedescendant', rows[1].id);

    await user.keyboard('{ArrowUp}');
    expect(trigger).toHaveAttribute('aria-activedescendant', rows[0].id);
  });

  it('stops at the ends rather than wrapping', async () => {
    const { user, trigger } = await open();
    const rows = screen.getAllByRole('option');

    await user.keyboard('{ArrowUp}');
    expect(trigger).toHaveAttribute('aria-activedescendant', rows[0].id);

    await user.keyboard('{End}');
    await user.keyboard('{ArrowDown}');
    expect(trigger).toHaveAttribute('aria-activedescendant', rows[2].id);
  });

  it('jumps to the first and last row with Home and End', async () => {
    const { user, trigger } = await open();
    const rows = screen.getAllByRole('option');

    await user.keyboard('{End}');
    expect(trigger).toHaveAttribute('aria-activedescendant', rows[2].id);

    await user.keyboard('{Home}');
    expect(trigger).toHaveAttribute('aria-activedescendant', rows[0].id);
  });

  it('commits the active row on Enter and closes', async () => {
    const { user, trigger } = await open();

    await user.keyboard('{ArrowDown}{Enter}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(within(trigger).getByText('build')).toBeInTheDocument();
    expect(document.querySelector('input[type="hidden"][name="status"]')).toHaveValue('n2');
  });

  it('leaves the selection untouched when Escape follows an arrow key', async () => {
    const { user, trigger } = await open();

    await user.keyboard('{ArrowDown}{Escape}');

    expect(within(trigger).getByText('checkout')).toBeInTheDocument();
    expect(document.querySelector('input[type="hidden"][name="status"]')).toHaveValue('n1');
  });
});

/*
 * The Run Detail page polls with router.refresh(), which re-executes the server
 * component and reconciles the result into the existing tree - this component keeps
 * its state while its `options` prop changes underneath it. Stages become eligible
 * for a log as the run progresses, so the list grows between renders, and a page
 * opened on a queued run mounts with no options at all.
 */
describe('an option list that changes under it', () => {
  const hiddenValue = () =>
    document.querySelector<HTMLInputElement>('input[type="hidden"][name="status"]')?.value;

  const shown = () => screen.getByRole('combobox').textContent;

  const withOptions = (options: FilterListboxOption[]) => (
    <FilterListbox id="status" name="status" options={options} setFilteredOption={noop} />
  );

  it('keeps the selection when an option is inserted ahead of it', () => {
    const { rerender } = render(withOptions(OPTIONS.slice(1)));
    expect(shown()).toContain('build');

    rerender(withOptions(OPTIONS));

    expect(shown()).toContain('build');
    expect(hiddenValue()).toBe('n2');
  });

  it('keeps the selection when an option is appended after it', () => {
    const { rerender } = render(withOptions(OPTIONS.slice(0, 2)));

    rerender(withOptions(OPTIONS));

    expect(shown()).toContain('checkout');
    expect(hiddenValue()).toBe('n1');
  });

  /*
   * A page opened while the run is still queued mounts with an empty list, and the
   * useState initializer that picks the default runs once - it cannot pick from a
   * list that has not arrived. Whatever the trigger displays has to be the value the
   * control actually holds, or the log pane reads an id nothing is showing.
   */
  it('adopts the first option when the list arrives after mount', () => {
    const { rerender } = render(withOptions([]));

    rerender(withOptions(OPTIONS));

    expect(shown()).toContain('checkout');
    expect(hiddenValue()).toBe('n1');
  });

  it('marks the option it adopted aria-selected', async () => {
    const user = userEvent.setup();
    const { rerender } = render(withOptions([]));
    rerender(withOptions(OPTIONS));

    await user.click(screen.getByRole('combobox'));

    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('adopts the first remaining option when the selected one disappears', () => {
    const { rerender } = render(withOptions(OPTIONS));
    expect(shown()).toContain('checkout');

    rerender(withOptions(OPTIONS.slice(1)));

    expect(shown()).toContain('build');
    expect(hiddenValue()).toBe('n2');
  });

  it('holds no value when there is nothing to select', () => {
    render(withOptions([]));

    expect(hiddenValue()).toBe('');
  });
});
