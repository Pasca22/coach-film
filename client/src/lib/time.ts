/** Seconds before / after the playhead that a new tag covers (you tag after seeing the play). */
export const TAG_BEFORE_S = 5;
export const TAG_AFTER_S = 3;

const round1 = (n: number) => Math.round(n * 10) / 10;
const pad = (n: number) => String(n).padStart(2, '0');

/** 75 → "1:15", 3725 → "1:02:05" */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export const formatRange = (start: number, end: number) => `${formatTime(start)} – ${formatTime(end)}`;
export const formatLength = (start: number, end: number) => `${Math.max(0, Math.round(end - start))}s`;

/** The clip window for a tag made at playhead `t`, clamped to the video. */
export function tagWindow(t: number, duration: number): { start_s: number; end_s: number } {
  const start = Math.max(0, t - TAG_BEFORE_S);
  let end = t + TAG_AFTER_S;
  if (duration > 0) end = Math.min(end, duration);
  if (end <= start) end = start + 1;
  return { start_s: round1(start), end_s: round1(end) };
}

export const roundTime = round1;

/** SQLite `datetime('now')` is UTC without a zone marker. */
export function formatWhen(sqliteUtc: string): string {
  const d = new Date(sqliteUtc.replace(' ', 'T') + 'Z');
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
