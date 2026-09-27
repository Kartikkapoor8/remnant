const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Human label for how long ago `iso` was, relative to `now`. */
export function relativeLabel(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < MIN) return "just now";
  if (diff < HOUR) return `${Math.round(diff / MIN)} min ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)} hours ago`;
  if (diff < 14 * DAY) return `${Math.round(diff / DAY)} days ago`;
  if (diff < 60 * DAY) return `${Math.round(diff / (7 * DAY))} weeks ago`;
  const months = Math.round(diff / (30.44 * DAY));
  if (months < 18) return `${months} months ago`;
  return `${Math.round(months / 12)} years ago`;
}

/** Whether the gap between two messages deserves a label in the thread. */
export function needsGapLabel(prevIso: string | undefined, iso: string): boolean {
  if (!prevIso) return true;
  return new Date(iso).getTime() - new Date(prevIso).getTime() > HOUR;
}
