import type { ReactNode } from 'react';
import { EVENT_TYPES, type EventType, type Opponent, type Player, type Team } from '../types';
import type { Person } from '../lib/filter';
import { TAG_AFTER_S, TAG_BEFORE_S } from '../lib/time';
import { PersonSelect } from './PersonSelect';
import { Kbd, Segmented } from './ui';

interface Props {
  players: Player[];
  opponents: Opponent[];
  team: Team;
  person: Person | null;
  disabled: boolean;
  onTeam: (team: Team) => void;
  onPerson: (person: Person | null) => void;
  onTag: (type: EventType) => void;
  children?: ReactNode; // opponent roster
}

export function TagBar({ players, opponents, team, person, disabled, onTeam, onPerson, onTag, children }: Props) {
  return (
    <section className="tagbar" aria-label="Tag events">
      <div className="tagbar-head">
        <h2 className="section-label">Tag at playhead</h2>
        <span className="muted small">
          Clip = {TAG_BEFORE_S}s before → {TAG_AFTER_S}s after
        </span>
      </div>
      <div className="tagbar-buttons">
        {EVENT_TYPES.map((t) => (
          <button key={t.type} className="tag-btn" onClick={() => onTag(t.type)} disabled={disabled}>
            <Kbd>{t.key}</Kbd>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="tagbar-options">
        <div className="field-inline">
          <span className="field-label">
            Team <Kbd>T</Kbd>
          </span>
          <Segmented
            label="Team for new tags"
            value={team}
            onChange={onTeam}
            options={[
              { value: 'us', label: 'Us' },
              { value: 'opponent', label: 'Opponent' },
            ]}
          />
        </div>
        <label className="field-inline">
          <span className="field-label">Player</span>
          <PersonSelect
            team={team}
            players={players}
            opponents={opponents}
            value={person}
            onChange={onPerson}
            emptyLabel={team === 'opponent' && opponents.length === 0 ? 'Add opponents below' : 'None'}
            label="Player for new tags"
          />
        </label>
      </div>
      {children}
    </section>
  );
}
