export type Team = 'us' | 'opponent';
export type EventType = 'pick_and_roll' | 'assist' | 'points' | 'possession';

/** One of the coach's own players (the roster). */
export interface Player {
  id: number;
  name: string;
  number: number;
}

/** An opposing player the coach added for this game. Name is optional. */
export interface Opponent {
  id: number;
  number: number;
  name: string;
}

export interface MatchEvent {
  id: number;
  type: EventType;
  team: Team;
  player_id: number | null; // set only when team = 'us'
  opponent_id: number | null; // set only when team = 'opponent'
  start_s: number;
  end_s: number;
  created_at: string;
}

export type EventInput = Pick<MatchEvent, 'type' | 'team' | 'player_id' | 'opponent_id' | 'start_s' | 'end_s'>;

export interface Assignment {
  id: number;
  event_id: number;
  player_id: number;
  note: string;
  watched_at: string | null;
  created_at: string;
  event: EventInput;
}

export const EVENT_TYPES: { type: EventType; label: string; key: string }[] = [
  { type: 'pick_and_roll', label: 'Pick & roll', key: '1' },
  { type: 'assist', label: 'Assist', key: '2' },
  { type: 'points', label: 'Points', key: '3' },
  { type: 'possession', label: 'Possession', key: '4' },
];

export const typeLabel = (type: EventType) => EVENT_TYPES.find((t) => t.type === type)?.label ?? type;
export const teamLabel = (team: Team) => (team === 'us' ? 'Us' : 'Opponent');
export const playerLabel = (p: Player | Opponent) => (p.name ? `#${p.number} ${p.name}` : `#${p.number}`);
