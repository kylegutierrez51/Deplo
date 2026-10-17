import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DefaultDirectoryPopover from '@/components/pipeline-editor/DefaultDirectoryPopover';
import { usePipelineGraph } from '@/components/pipeline-editor/PipelineGraphProvider';

/*
 * The popover only talks to the editor through defaultDirectory/setDefaultDirectory, so the
 * graph context is stubbed. It sits behind a button rather than in the header bar because the
 * bar has no room for a second input at laptop widths: it pushed Save and Run off-screen.
 */
jest.mock('@/components/pipeline-editor/PipelineGraphProvider', () => ({
  usePipelineGraph: jest.fn(),
}));

const useGraph = usePipelineGraph as jest.MockedFunction<typeof usePipelineGraph>;
const setDefaultDirectory = jest.fn();

function setup(defaultDirectory = '') {
  useGraph.mockReturnValue({ defaultDirectory, setDefaultDirectory } as never);
  const user = userEvent.setup();
  render(
    <>
      <DefaultDirectoryPopover />
      <button type="button">elsewhere</button>
    </>
  );
  return { user, trigger: screen.getByRole('button', { name: 'Default directory' }) };
}

beforeEach(() => { setDefaultDirectory.mockClear(); });

describe('the trigger', () => {
  it('starts closed', () => {
    const { trigger } = setup();

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('DEFAULT DIRECTORY')).not.toBeInTheDocument();
  });

  // The path is the one thing worth knowing without opening it.
  it('names the current default in its tooltip', () => {
    const { trigger } = setup('/srv/app');

    expect(trigger).toHaveAttribute('title', 'Default directory: /srv/app');
  });

  it('says there is none when unset', () => {
    const { trigger } = setup();

    expect(trigger).toHaveAttribute('title', 'No default directory');
  });
});

describe('the popover', () => {
  it('opens with the input focused', async () => {
    const { user, trigger } = setup('/srv/app');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('DEFAULT DIRECTORY')).toHaveFocus();
    expect(screen.getByLabelText('DEFAULT DIRECTORY')).toHaveValue('/srv/app');
  });

  it('writes what is typed to the editor state', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);

    await user.type(screen.getByLabelText('DEFAULT DIRECTORY'), 'a');

    expect(setDefaultDirectory).toHaveBeenLastCalledWith('a');
  });

  // The directory is written into commands quoted, so a quote would end that string early.
  it('drops double quotes as they are typed', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);

    await user.type(screen.getByLabelText('DEFAULT DIRECTORY'), '"');

    expect(setDefaultDirectory).toHaveBeenLastCalledWith('');
  });

  it('closes on Escape and hands focus back to the trigger', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);

    await user.keyboard('{Escape}');

    expect(screen.queryByLabelText('DEFAULT DIRECTORY')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes when the pointer lands outside it', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);

    await user.click(screen.getByRole('button', { name: 'elsewhere' }));

    expect(screen.queryByLabelText('DEFAULT DIRECTORY')).not.toBeInTheDocument();
  });

  it('toggles closed from the trigger', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
