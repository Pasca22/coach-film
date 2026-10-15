import type { Assignment, EventInput, MatchEvent, Player } from './types';

export const VIDEO_URL = '/video/match.mp4';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  players: () => request<Player[]>('GET', '/players'),

  events: () => request<MatchEvent[]>('GET', '/events'),
  createEvent: (input: EventInput) => request<MatchEvent>('POST', '/events', input),
  updateEvent: (id: number, patch: Partial<EventInput>) => request<MatchEvent>('PATCH', `/events/${id}`, patch),
  deleteEvent: (id: number) => request<void>('DELETE', `/events/${id}`),

  assignments: (playerId?: number) =>
    request<Assignment[]>('GET', playerId ? `/assignments?player=${playerId}` : '/assignments'),
  createAssignment: (input: { event_id: number; player_id: number; note: string }) =>
    request<Assignment>('POST', '/assignments', input),
  updateAssignment: (id: number, patch: { note?: string; watched?: boolean }) =>
    request<Assignment>('PATCH', `/assignments/${id}`, patch),
  deleteAssignment: (id: number) => request<void>('DELETE', `/assignments/${id}`),

  videoStatus: () => request<{ available: boolean }>('GET', '/video'),
};

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));
