import { EVENT_TYPES, playerLabel, type EventType, type Player, type Team } from '../types';
import { TAG_AFTER_S, TAG_BEFORE_S } from '../lib/time';
import { Kbd, Segmented } from './ui';

interface Props {
  players: Player[];
  team: Team;
  playerId: number | null;
  disabled: boolean;
  onTeam: (team: Team) => void;
  onPlayer: (id: number | null) => void;
  onTag: (type: EventType) => void;
}

export function TagBar({ players, team, playerId, disabled, onTeam, onPlayer, onTag }: Props) {
  const teamPlayers = players.filter((p) => p.team === team);
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
          <select
            className="select"
            value={playerId ?? ''}
            onChange={(e) => {
              onPlayer(e.target.value ? Number(e.target.value) : null);
              e.currentTarget.blur(); // give the keyboard back to the hotkeys
            }}
          >
            <option value="">None</option>
            {teamPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {playerLabel(p)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
