import { useEffect, useRef } from 'react';
import { EVENT_TYPES, playerLabel, typeLabel, type EventInput, type MatchEvent, type Player } from '../types';
import { formatLength, formatRange, formatTime } from '../lib/time';
import { ReplayIcon, SendIcon, TrashIcon } from './icons';
import { Kbd, Segmented, TeamChip } from './ui';

interface Props {
  events: MatchEvent[];
  players: Player[];
  assignedTo: Map<number, Player[]>;
  selectedId: number | null;
  onSelect: (event: MatchEvent) => void;
  onChange: (event: MatchEvent, patch: Partial<EventInput>) => void;
  onSetEdge: (edge: 'start' | 'end') => void;
  onReplay: (event: MatchEvent) => void;
  onAssign: (event: MatchEvent) => void;
  onDelete: (event: MatchEvent) => void;
}

export function EventList(props: Props) {
  const { events, selectedId } = props;
  return (
    <ol className="event-list">
      {events.map((e) => (
        <EventRow key={e.id} event={e} selected={e.id === selectedId} {...props} />
      ))}
    </ol>
  );
}

function EventRow({
  event: e,
  selected,
  players,
  assignedTo,
  onSelect,
  onChange,
  onSetEdge,
  onReplay,
  onAssign,
  onDelete,
}: Props & { event: MatchEvent; selected: boolean }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  const player = players.find((p) => p.id === e.player_id);
  const assigned = assignedTo.get(e.id) ?? [];

  return (
    <li ref={ref} className={`event-row ${selected ? 'is-selected' : ''}`}>
      <button className="event-row-main" onClick={() => onSelect(e)}>
        <span className="event-row-time">{formatTime(e.start_s)}</span>
        <span className="event-row-body">
          <span className="event-row-title">
            {typeLabel(e.type)}
            {player && <span className="muted"> · #{player.number}</span>}
          </span>
          <span className="event-row-meta">
            {formatLength(e.start_s, e.end_s)}
            {assigned.length > 0 && <> · sent to {assigned.length}</>}
          </span>
        </span>
        <TeamChip team={e.team} />
      </button>

      {selected && (
        <div className="event-editor">
          <div className="event-editor-types">
            {EVENT_TYPES.map((t) => (
              <button
                key={t.type}
                className={`chip ${e.type === t.type ? 'is-active' : ''}`}
                onClick={() => e.type !== t.type && onChange(e, { type: t.type })}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="event-editor-row">
            <Segmented
              label="Team"
              value={e.team}
              onChange={(team) => team !== e.team && onChange(e, { team })}
              options={[
                { value: 'us', label: 'Us' },
                { value: 'opponent', label: 'Opp' },
              ]}
            />
            <select
              className="select select-grow"
              aria-label="Player"
              value={e.player_id ?? ''}
              onChange={(ev) => {
                onChange(e, { player_id: ev.target.value ? Number(ev.target.value) : null });
                ev.currentTarget.blur(); // give the keyboard back to the hotkeys
              }}
            >
              <option value="">No player</option>
              {players
                .filter((p) => p.team === e.team)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {playerLabel(p)}
                  </option>
                ))}
            </select>
          </div>

          <div className="event-editor-edges">
            <EdgeControl
              label="Start"
              value={e.start_s}
              hotkey="["
              onSet={() => onSetEdge('start')}
              onNudge={(d) => onChange(e, { start_s: Math.max(0, e.start_s + d) })}
            />
            <EdgeControl
              label="End"
              value={e.end_s}
              hotkey="]"
              onSet={() => onSetEdge('end')}
              onNudge={(d) => onChange(e, { end_s: e.end_s + d })}
            />
          </div>
          <p className="muted small">{formatRange(e.start_s, e.end_s)}</p>

          {assigned.length > 0 && (
            <p className="small">
              <span className="muted">Sent to </span>
              {assigned.map((p) => `#${p.number} ${p.name}`).join(', ')}
            </p>
          )}

          <div className="event-editor-actions">
            <button className="btn btn-primary" onClick={() => onAssign(e)}>
              <SendIcon /> Assign
            </button>
            <button className="btn" onClick={() => onReplay(e)}>
              <ReplayIcon /> Replay
            </button>
            <span className="spacer" />
            <button className="icon-btn" onClick={() => onDelete(e)} aria-label="Delete event" title="Delete event">
              <TrashIcon />
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function EdgeControl({
  label,
  value,
  hotkey,
  onSet,
  onNudge,
}: {
  label: string;
  value: number;
  hotkey: string;
  onSet: () => void;
  onNudge: (delta: number) => void;
}) {
  return (
    <div className="edge">
      <span className="field-label">{label}</span>
      <div className="edge-controls">
        <button className="pill-btn" onClick={() => onNudge(-1)} aria-label={`${label} minus 1 second`}>
          −1s
        </button>
        <span className="edge-value">{formatTime(value)}</span>
        <button className="pill-btn" onClick={() => onNudge(1)} aria-label={`${label} plus 1 second`}>
          +1s
        </button>
      </div>
      <button className="link-btn" onClick={onSet}>
        Set to playhead <Kbd>{hotkey}</Kbd>
      </button>
    </div>
  );
}
