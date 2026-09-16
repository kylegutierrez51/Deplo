import { render, screen } from '@testing-library/react';
import EmptyState from '@/components/ui/EmptyState';

/*
 * EmptyState fills the space every list page currently leaves blank when a
 * query is empty. It has to stay a server component (no hooks) so async page
 * components and the client LogsTab can both render it, and the `action`
 * link/icon and `fill` modifier are opt-in per the brief, so each is tested
 * both present and absent.
 */
describe('EmptyState', () => {
  it('renders the heading, description, and icon', () => {
    render(
      <EmptyState
        icon="git-network-outline"
        heading="No pipelines yet"
        description="Create your first pipeline to get started."
      />
    );

    expect(screen.getByRole('heading', { name: 'No pipelines yet' })).toBeInTheDocument();
    expect(screen.getByText('Create your first pipeline to get started.')).toBeInTheDocument();
    expect(document.querySelector('ion-icon[name="git-network-outline"]')).not.toBeNull();
  });

  it('renders an action link with the given label, href, and icon', () => {
    render(
      <EmptyState
        icon="git-network-outline"
        heading="No pipelines yet"
        description="Create your first pipeline to get started."
        action={{ label: 'New Pipeline', href: '/pipelines?mode=create', icon: 'add-outline' }}
      />
    );

    const link = screen.getByRole('link', { name: 'New Pipeline' });
    expect(link).toHaveAttribute('href', '/pipelines?mode=create');
    expect(link.querySelector('ion-icon[name="add-outline"]')).not.toBeNull();
  });

  it('renders no link when action is omitted', () => {
    render(
      <EmptyState
        icon="git-network-outline"
        heading="No pipelines yet"
        description="Create your first pipeline to get started."
      />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('has role="status" on the container', () => {
    render(
      <EmptyState
        icon="git-network-outline"
        heading="No pipelines yet"
        description="Create your first pipeline to get started."
      />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('adds the fill class only when fill is true', () => {
    const { rerender } = render(
      <EmptyState
        icon="git-network-outline"
        heading="No pipelines yet"
        description="Create your first pipeline to get started."
      />
    );
    expect(screen.getByRole('status')).not.toHaveClass('fill');

    rerender(
      <EmptyState
        icon="git-network-outline"
        heading="No pipelines yet"
        description="Create your first pipeline to get started."
        fill
      />
    );
    expect(screen.getByRole('status')).toHaveClass('fill');
  });
});
