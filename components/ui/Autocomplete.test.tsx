import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Autocomplete from '@/components/ui/Autocomplete';

const options = [
  { id: 'a-1', name: 'deploy-api', detail: 'github.com/acme/api' },
  { id: 'b-1', name: 'build-web' },
  { id: 'b-2', name: 'build-web' },
];

type Props = React.ComponentProps<typeof Autocomplete>;

/* Inside a form so the hidden input's value can be read the way the server action sees it. */
const setup = (over: Partial<Props> = {}) => {
  render(
    <form data-testid="form">
      <label htmlFor="pick">Pick</label>
      <Autocomplete id="pick" idName="pick_id" placeholder="" emptyText="No matches" options={options} {...over} />
    </form>
  );
  return { input: screen.getByLabelText('Pick') };
};

const submitted = (name: string) => new FormData(screen.getByTestId('form') as HTMLFormElement).get(name);

it('seeds the selection from initialId, so a shared name still resolves to the saved record', () => {
  const { input } = setup({ initialId: 'b-2', initialName: 'build-web' });

  expect(input).toHaveValue('build-web');
  expect(submitted('pick_id')).toBe('b-2');
});

it('submits the option the user clicks, with its detail shown alongside', async () => {
  const user = userEvent.setup();
  const { input } = setup();

  await user.type(input, 'api');
  expect(screen.getByText('github.com/acme/api')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /deploy-api/ }));

  expect(input).toHaveValue('deploy-api');
  expect(submitted('pick_id')).toBe('a-1');
});

it('drops the selection once the text is edited', async () => {
  const user = userEvent.setup();
  const { input } = setup({ initialId: 'a-1', initialName: 'deploy-api' });

  await user.type(input, 'x');

  expect(submitted('pick_id')).toBe('');
});

it('leaves a name two options share unresolved', async () => {
  const user = userEvent.setup();
  const { input } = setup();

  await user.type(input, 'build-web');
  await user.tab();

  expect(submitted('pick_id')).toBe('');
});

it('says so when nothing matches', async () => {
  const user = userEvent.setup();
  const { input } = setup();

  await user.type(input, 'zzz');

  expect(screen.getByText('No matches')).toBeInTheDocument();
});

it('submits the raw text only when given a textName', async () => {
  const user = userEvent.setup();
  setup({ textName: 'pick_name' });

  await user.type(screen.getByLabelText('Pick'), 'typo');

  expect(submitted('pick_name')).toBe('typo');
});
