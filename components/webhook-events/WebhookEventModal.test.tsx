import { act, fireEvent, render, screen } from '@testing-library/react';
import WebhookEventModal from '@/components/webhook-events/WebhookEventModal';
import { replayWebhookEvent } from '@/lib/actions/webhook-events';

jest.mock('@/lib/actions/webhook-events', () => ({ replayWebhookEvent: jest.fn() }));

// mock-prefixed so the hoisted factories may close over them; read at render or click time.
const mockPush = jest.fn();
const mockShowToast = jest.fn();
let mockSearch = '';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}));
jest.mock('@/components/ui/toast/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const replay = replayWebhookEvent as jest.MockedFunction<typeof replayWebhookEvent>;

beforeEach(() => {
  mockPush.mockClear();
  mockShowToast.mockClear();
  replay.mockReset();
  mockSearch = '';
});

type Props = React.ComponentProps<typeof WebhookEventModal>;

const setup = (over: Partial<Props> = {}) =>
  render(
    <WebhookEventModal
      id="evt-1"
      source="github"
      replayBlockedReason={null}
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

describe('the source', () => {
  it('reads GitHub for a delivery from GitHub', () => {
    setup({ source: 'github' });
    expect(screen.getByText('Source').parentElement).toHaveTextContent('GitHub');
  });

  it('reads Replayed from Deplo for a replay', () => {
    setup({ source: 'replay' });
    expect(screen.getByText('Replayed from Deplo')).toBeInTheDocument();
  });
});

describe('replaying', () => {
  it('enables Replay when nothing blocks it', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Replay' })).toBeEnabled();
  });

  it('disables Replay with the blocker as its title', () => {
    setup({ replayBlockedReason: 'This webhook is inactive. Activate it to replay its events.' });
    const button = screen.getByRole('button', { name: 'Replay' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'This webhook is inactive. Activate it to replay its events.');
  });

  // ConfirmationModal keeps its confirm button disabled for a few seconds.
  describe('confirming', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const confirm = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
      expect(screen.getByText('Replay this delivery?')).toBeInTheDocument();
      expect(screen.getByText(/may start a new run for the same commit/)).toBeInTheDocument();
      await act(async () => { jest.advanceTimersByTime(3500); });
      const buttons = screen.getAllByRole('button', { name: 'Replay' });
      await act(async () => { fireEvent.click(buttons[buttons.length - 1]); });
    };

    it('replays, toasts the result with a run link, and opens the new event', async () => {
      replay.mockResolvedValue({ status: 'success', message: 'Started CI #5.', webhookEventId: 'evt-new', runId: 'run-1' } as never);
      setup();

      await confirm();

      expect(replay).toHaveBeenCalledWith('evt-1');
      expect(mockShowToast).toHaveBeenCalledWith({
        text: 'Started CI #5.',
        icon: 'checkmark-circle-outline',
        link: '/runs/run-1',
        options: { sticky: true },
      });
      expect(mockPush).toHaveBeenCalledWith('/webhooks/events?id=evt-new');
    });

    it('keeps the list filters when opening the new event', async () => {
      mockSearch = 'status=failed&id=evt-1';
      replay.mockResolvedValue({ status: 'success', message: 'ok', webhookEventId: 'evt-new' } as never);
      setup();

      await confirm();

      expect(mockPush).toHaveBeenCalledWith('/webhooks/events?status=failed&id=evt-new');
    });

    it('drops the modal mode when opening the new event', async () => {
      mockSearch = 'id=evt-1&mode=view';
      replay.mockResolvedValue({ status: 'success', message: 'ok', webhookEventId: 'evt-new' } as never);
      setup();

      await confirm();

      expect(mockPush).toHaveBeenCalledWith('/webhooks/events?id=evt-new');
    });

    it('toasts an error and stays put when the replay fails to start', async () => {
      replay.mockResolvedValue({ status: 'error', message: 'Nope.' } as never);
      setup();

      await confirm();

      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ text: 'Nope.', icon: 'close-circle-outline', link: undefined }));
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('shows the info icon, with no link, for a replay that was ignored', async () => {
      replay.mockResolvedValue({ status: 'success', message: 'Replayed: filtered.', webhookEventId: 'evt-new', eventStatus: 'ignored' } as never);
      setup();

      await confirm();

      expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'information-circle-outline', link: undefined }));
    });

    it('toasts an error and does not navigate when the action rejects', async () => {
      replay.mockRejectedValue(new Error('network down'));
      setup();

      await confirm();

      expect(mockShowToast).toHaveBeenCalledWith({
        text: 'Could not replay this event. Try again.',
        icon: 'close-circle-outline',
        options: { sticky: true },
      });
      expect(mockPush).not.toHaveBeenCalled();
      expect(screen.queryByText('Replay this delivery?')).not.toBeInTheDocument();
    });
  });
});
