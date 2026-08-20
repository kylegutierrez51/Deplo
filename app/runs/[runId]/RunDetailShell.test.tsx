import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RunDetailShell from './RunDetailShell';

/*
 * Two independent pieces of state living in one component: which tab is showing, and
 * whether the run header is collapsed. Neither may move the other — a reader who hides
 * the card to read logs should still have it hidden after a glance at the graph.
 *
 * The card is hidden with CSS rather than unmounted, so the grid-rows transition has
 * something to animate and nothing inside it remounts. jsdom applies neither CSS
 * modules nor `inert`, so the assertions read the state attributes the stylesheet keys
 * off instead of visibility — which is also what a screen reader reads.
 */

const setup = () => {
  const user = userEvent.setup();

  render(
    <RunDetailShell
      header={<p>run detail card</p>}
      overview={<p>overview panel</p>}
      logs={<p>logs panel</p>}
    />
  );

  return {
    user,
    toggle: () => screen.getByRole('button', { name: /run details/i }),
    header: () => document.getElementById('run-header')!,
  };
};

describe('RunDetailShell', () => {
  it('starts expanded, with the header rendered', () => {
    const { toggle, header } = setup();

    expect(screen.getByText('run detail card')).toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(header()).toHaveAttribute('data-collapsed', 'false');
    expect(header()).not.toHaveAttribute('inert');
  });

  it('points the toggle at the header it controls', () => {
    const { toggle, header } = setup();

    expect(toggle()).toHaveAttribute('aria-controls', header().id);
  });

  it('collapses the header on click and takes it out of the tab order', async () => {
    const { user, toggle, header } = setup();

    await user.click(toggle());

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(header()).toHaveAttribute('data-collapsed', 'true');
    expect(header()).toHaveAttribute('inert');
  });

  it('expands again on a second click', async () => {
    const { user, toggle, header } = setup();

    await user.click(toggle());
    await user.click(toggle());

    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(header()).toHaveAttribute('data-collapsed', 'false');
    expect(header()).not.toHaveAttribute('inert');
  });

  it('keeps the header collapsed across a tab switch', async () => {
    const { user, toggle, header } = setup();

    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: /logs/i }));

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(header()).toHaveAttribute('data-collapsed', 'true');

    await user.click(screen.getByRole('button', { name: /overview/i }));

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(header()).toHaveAttribute('data-collapsed', 'true');
  });

  it('leaves the collapsed header in the DOM so nothing inside it remounts', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /run details/i }));

    expect(screen.getByText('run detail card')).toBeInTheDocument();
  });
});
