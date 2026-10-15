import type { EventType, MatchEvent, Team } from '../types';

export interface EventFilters {
  types: EventType[]; // empty = all types
  team: Team | 'all';
  playerId: number | null;
}

export const NO_FILTERS: EventFilters = { types: [], team: 'all', playerId: null };

export const hasFilters = (f: EventFilters) => f.types.length > 0 || f.team !== 'all' || f.playerId !== null;

export function filterEvents(events: MatchEvent[], f: EventFilters): MatchEvent[] {
  return events.filter(
    (e) =>
      (f.types.length === 0 || f.types.includes(e.type)) &&
      (f.team === 'all' || e.team === f.team) &&
      (f.playerId === null || e.player_id === f.playerId),
  );
}
