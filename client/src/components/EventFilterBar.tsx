import { EVENT_TYPES, playerLabel, type Player, type Team } from '../types';
import { hasFilters, NO_FILTERS, type EventFilters } from '../lib/filter';
import { Segmented } from './ui';

interface Props {
  players: Player[];
  filters: EventFilters;
  onChange: (filters: EventFilters) => void;
}

export function EventFilterBar({ players, filters, onChange }: Props) {
  const toggleType = (type: (typeof EVENT_TYPES)[number]['type']) => {
    const types = filters.types.includes(type) ? filters.types.filter((t) => t !== type) : [...filters.types, type];
    onChange({ ...filters, types });
  };

  const setTeam = (team: Team | 'all') => {
    const player = players.find((p) => p.id === filters.playerId);
    // Drop a player filter that no longer matches the team.
    const playerId = player && team !== 'all' && player.team !== team ? null : filters.playerId;
    onChange({ ...filters, team, playerId });
  };

  const groups: { team: Team; label: string }[] = [
    { team: 'us', label: 'Us' },
    { team: 'opponent', label: 'Opponent' },
  ];

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
        <select
          className="select select-grow"
          aria-label="Filter by player"
          value={filters.playerId ?? ''}
          onChange={(e) => {
            onChange({ ...filters, playerId: e.target.value ? Number(e.target.value) : null });
            e.currentTarget.blur(); // give the keyboard back to the hotkeys
          }}
        >
          <option value="">All players</option>
          {groups
            .filter((g) => filters.team === 'all' || filters.team === g.team)
            .map((g) => (
              <optgroup key={g.team} label={g.label}>
                {players
                  .filter((p) => p.team === g.team)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {playerLabel(p)}
                    </option>
                  ))}
              </optgroup>
            ))}
        </select>
        {hasFilters(filters) && (
          <button className="link-btn" onClick={() => onChange(NO_FILTERS)}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
