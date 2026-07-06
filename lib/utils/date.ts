export function getTimeDifference(start: Date, end: Date): string {
  const totalSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [days, hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export function formatDate(date: Date) {
  return date.toLocaleString('en-US', {
    year: '2-digit', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

export function getWaitingTime(start: Date, end: Date = new Date()): string {
  const totalMinutes = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
