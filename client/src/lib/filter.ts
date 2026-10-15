import type { EventType, MatchEvent, Team } from '../types';

/** Who an event is about: one of our players, or one of this game's opponents. */
export type Person = { kind: 'player' | 'opponent'; id: number };

export interface EventFilters {
  types: EventType[]; // empty = all types
  team: Team | 'all';
  person: Person | null;
}

export const NO_FILTERS: EventFilters = { types: [], team: 'all', person: null };

export const hasFilters = (f: EventFilters) => f.types.length > 0 || f.team !== 'all' || f.person !== null;

export const personOf = (e: Pick<MatchEvent, 'player_id' | 'opponent_id'>): Person | null =>
  e.player_id !== null
    ? { kind: 'player', id: e.player_id }
    : e.opponent_id !== null
      ? { kind: 'opponent', id: e.opponent_id }
      : null;

/** Encodes a person for a <select> value: "player:3" / "opponent:7" / "". */
export const personKey = (p: Person | null) => (p ? `${p.kind}:${p.id}` : '');
export function parsePersonKey(key: string): Person | null {
  const [kind, id] = key.split(':');
  return kind === 'player' || kind === 'opponent' ? { kind, id: Number(id) } : null;
}

export function filterEvents(events: MatchEvent[], f: EventFilters): MatchEvent[] {
  return events.filter(
    (e) =>
      (f.types.length === 0 || f.types.includes(e.type)) &&
      (f.team === 'all' || e.team === f.team) &&
      (f.person === null || personKey(personOf(e)) === personKey(f.person)),
  );
}
