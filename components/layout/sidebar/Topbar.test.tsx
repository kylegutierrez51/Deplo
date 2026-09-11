import { render, screen } from '@testing-library/react';
import Topbar from '@/components/layout/sidebar/Topbar';
import { SidebarProvider } from '@/components/layout/sidebar/SidebarContext';

// useSidebar throws outside its provider
const renderTopbar = (activeItem: string | undefined) =>
  render(<SidebarProvider><Topbar activeItem={activeItem} showToggle /></SidebarProvider>);

describe('Topbar', () => {
  it('links the Webhook Events page back to Webhooks', () => {
    renderTopbar('webhook-events');

    expect(screen.getByRole('link', { name: 'Webhooks' })).toHaveAttribute('href', '/webhooks');
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toBeInTheDocument();
  });

  it('links the Run Detail page back to Run History', () => {
    renderTopbar('run-detail');

    expect(screen.getByRole('link', { name: 'Run History' })).toHaveAttribute('href', '/runs');
  });

  it('shows only the toggle on a top-level page', () => {
    renderTopbar('pipelines');

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toBeInTheDocument();
  });
});