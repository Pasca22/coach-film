import { EVENT_TYPES, type Opponent, type Player, type Team } from '../types';
import { hasFilters, NO_FILTERS, type EventFilters } from '../lib/filter';
import { PersonSelect } from './PersonSelect';
import { Segmented } from './ui';

interface Props {
  players: Player[];
  opponents: Opponent[];
  filters: EventFilters;
  onChange: (filters: EventFilters) => void;
}

export function EventFilterBar({ players, opponents, filters, onChange }: Props) {
  const toggleType = (type: (typeof EVENT_TYPES)[number]['type']) => {
    const types = filters.types.includes(type) ? filters.types.filter((t) => t !== type) : [...filters.types, type];
    onChange({ ...filters, types });
  };

  const setTeam = (team: Team | 'all') => {
    // Drop a person filter that no longer matches the team.
    const p = filters.person;
    const keep = !p || team === 'all' || (team === 'us') === (p.kind === 'player');
    onChange({ ...filters, team, person: keep ? p : null });
  };

  return (
    <div className="filters">
      <div className="chips" role="group" aria-label="Filter by type">
        <button
          className={`chip ${filters.types.length === 0 ? 'is-active' : ''}`}
          onClick={() => onChange({ ...filters, types: [] })}
        >
          All
        </button>
        {EVENT_TYPES.map((t) => (
          <button
            key={t.type}
            className={`chip ${filters.types.includes(t.type) ? 'is-active' : ''}`}
            aria-pressed={filters.types.includes(t.type)}
            onClick={() => toggleType(t.type)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="filters-row">
        <Segmented
          label="Filter by team"
          value={filters.team}
          onChange={setTeam}
          options={[
            { value: 'all', label: 'Both' },
            { value: 'us', label: 'Us' },
            { value: 'opponent', label: 'Opp' },
          ]}
        />
        <PersonSelect
          className="select select-grow"
          team={filters.team}
          players={players}
          opponents={opponents}
          value={filters.person}
          onChange={(person) => onChange({ ...filters, person })}
          emptyLabel="All players"
          label="Filter by player"
        />
        {hasFilters(filters) && (
          <button className="link-btn" onClick={() => onChange(NO_FILTERS)}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
