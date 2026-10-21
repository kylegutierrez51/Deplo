import { act, fireEvent, render, screen } from '@testing-library/react';
import CopyField from './CopyField';

const writeText = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

it('shows the value in a read-only field labelled by the label', () => {
  render(<CopyField label="Deplo endpoint" value="http://localhost:3000/api/webhook/wh-1" />);
  const input = screen.getByLabelText('Deplo endpoint') as HTMLInputElement;
  expect(input.value).toBe('http://localhost:3000/api/webhook/wh-1');
  expect(input.readOnly).toBe(true);
});

it('copies exactly the shown value', () => {
  render(<CopyField label="Payload URL" value="https://smee.io/abc123" />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy Payload URL' }));
  expect(writeText).toHaveBeenCalledWith('https://smee.io/abc123');
});

it('shows a checkmark briefly after copying', () => {
  jest.useFakeTimers();
  const { container } = render(<CopyField label="Payload URL" value="x" />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy Payload URL' }));
  expect(container.querySelector('ion-icon')?.getAttribute('name')).toBe('checkmark-outline');
  act(() => { jest.advanceTimersByTime(1500); });
  expect(container.querySelector('ion-icon')?.getAttribute('name')).toBe('copy-outline');
  jest.useRealTimers();
});
