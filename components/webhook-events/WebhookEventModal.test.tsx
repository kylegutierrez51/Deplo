import { render, screen } from '@testing-library/react';
import WebhookEventModal from '@/components/webhook-events/WebhookEventModal';

type Props = React.ComponentProps<typeof WebhookEventModal>;

const setup = (over: Partial<Props> = {}) =>
  render(
    <WebhookEventModal
      status="failed"
      eventType="push"
      branch="refs/heads/main"
      commitSha="abc1234"
      commitMessage="Fix the thing"
      pipeline={{ name: 'CI', repoUrl: 'https://github.com/o/web-client' }}
      receivedAt={new Date('2026-01-01T00:00:00Z')}
      onClose={jest.fn()}
      {...over}
    />,
  );

describe('the status reason', () => {
  // Validation errors arrive as one line per problem; the modal is where they are read in full.
  it('shows the whole reason, line breaks included', () => {
    const reason = 'Cannot run pipeline:\n• Stage "build" has no command.';
    setup({ statusReason: reason });

    expect(screen.getByText('Reason')).toBeInTheDocument();
    expect(screen.getByTestId('status-reason').textContent).toBe(reason);
  });

  // A pending event has no outcome yet; the label stays so the layout does not jump when one arrives.
  it('shows an em dash when there is no reason yet', () => {
    setup({ status: 'pending', statusReason: null });

    expect(screen.getByTestId('status-reason')).toHaveTextContent('—');
  });
});
