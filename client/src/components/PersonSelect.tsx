import { parsePersonKey, personKey, type Person } from '../lib/filter';
import { playerLabel, type Opponent, type Player, type Team } from '../types';

interface Props {
  team: Team | 'all';
  players: Player[];
  opponents: Opponent[];
  value: Person | null;
  onChange: (person: Person | null) => void;
  emptyLabel: string;
  label: string;
  className?: string;
}

/** Pick one of our players and/or one of this game's opponents, depending on `team`. */
export function PersonSelect({ team, players, opponents, value, onChange, emptyLabel, label, className = 'select' }: Props) {
  const ours = players.map((p) => (
    <option key={`p${p.id}`} value={personKey({ kind: 'player', id: p.id })}>
      {playerLabel(p)}
    </option>
  ));
  const theirs = opponents.map((o) => (
    <option key={`o${o.id}`} value={personKey({ kind: 'opponent', id: o.id })}>
      {playerLabel(o)}
    </option>
  ));

  return (
    <select
      className={className}
      aria-label={label}
      value={personKey(value)}
      onChange={(e) => {
        onChange(parsePersonKey(e.target.value));
        e.currentTarget.blur(); // give the keyboard back to the hotkeys
      }}
    >
      <option value="">{emptyLabel}</option>
      {team === 'us' && ours}
      {team === 'opponent' && theirs}
      {team === 'all' && (
        <>
          <optgroup label="Our team">{ours}</optgroup>
          {opponents.length > 0 && <optgroup label="Opponents">{theirs}</optgroup>}
        </>
      )}
    </select>
  );
}
