import { fireEvent, render, screen } from '@testing-library/react';
import RepoLink from '@/components/ui/RepoLink';

describe('RepoLink', () => {
  it('labels a GitHub repo owner/repo and links to it in a new tab', () => {
    render(<RepoLink repoUrl="https://github.com/kylegutierrez51/Deplo" />);

    const link = screen.getByRole('link', { name: 'kylegutierrez51/Deplo' });
    expect(link).toHaveAttribute('href', 'https://github.com/kylegutierrez51/Deplo');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('links an scp-style address to its https page', () => {
    render(<RepoLink repoUrl="git@github.com:o/r.git" />);

    expect(screen.getByRole('link', { name: 'o/r' })).toHaveAttribute('href', 'https://github.com/o/r');
  });

  it('shows the repo name alone when short, keeping owner/repo in the title', () => {
    render(<RepoLink repoUrl="https://github.com/kylegutierrez51/Deplo" short />);

    const link = screen.getByRole('link', { name: 'Deplo' });
    expect(link).toHaveAttribute('href', 'https://github.com/kylegutierrez51/Deplo');
    expect(link).toHaveAttribute('title', 'kylegutierrez51/Deplo');
  });

  // RunRow and WebhookEventRow open a modal on row click; following the link must not.
  it('does not let the click reach a clickable row around it', () => {
    const onRowClick = jest.fn();
    render(<div onClick={onRowClick}><RepoLink repoUrl="https://github.com/o/r" /></div>);

    fireEvent.click(screen.getByRole('link'));

    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('renders an unparseable value as plain text with no link', () => {
    render(<RepoLink repoUrl="javascript:alert(1)" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument();
  });
});
