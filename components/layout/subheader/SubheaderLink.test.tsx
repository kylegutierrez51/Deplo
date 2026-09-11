import { render, screen } from '@testing-library/react';
import SubheaderLink from '@/components/layout/subheader/SubheaderLink';

describe('SubheaderLink', () => {
  it('renders a link to the given page', () => {
    render(<SubheaderLink href="/webhooks/events" icon="pulse-outline" text="View Events" />);

    expect(screen.getByRole('link', { name: 'View Events' })).toHaveAttribute('href', '/webhooks/events');
  });
});
