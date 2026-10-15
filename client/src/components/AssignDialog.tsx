import { useState } from 'react';
import { api, errorMessage } from '../api';
import { typeLabel, teamLabel, type Assignment, type MatchEvent, type Player } from '../types';
import { formatRange } from '../lib/time';
import { CheckIcon } from './icons';
import { Modal } from './ui';

interface Props {
  event: MatchEvent;
  players: Player[];
  assignments: Assignment[];
  onClose: () => void;
  onAssigned: (created: Assignment[], options?: { keepOpen: boolean }) => void;
}

export function AssignDialog({ event, players, assignments, onClose, onAssigned }: Props) {
  const already = new Set(assignments.filter((a) => a.event_id === event.id).map((a) => a.player_id));
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: number) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const results = await Promise.allSettled(
      [...picked].map((player_id) => api.createAssignment({ event_id: event.id, player_id, note })),
    );
    const created = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    const failed = results.flatMap((r) => (r.status === 'rejected' ? [errorMessage(r.reason)] : []));
    if (failed.length === 0) return onAssigned(created);
    // Keep the dialog open; players that succeeded now show as "Already has it".
    if (created.length) onAssigned(created, { keepOpen: true });
    setPicked(new Set());
    setError(failed.join(' · '));
    setBusy(false);
  };

  return (
    <Modal title="Assign clip" onClose={onClose}>
      <p className="muted">
        {typeLabel(event.type)} · {teamLabel(event.team)} · {formatRange(event.start_s, event.end_s)}
      </p>

      <fieldset className="pick-list">
        <legend className="field-label">Players</legend>
        {players.map((p) => {
          const done = already.has(p.id);
          const on = done || picked.has(p.id);
          return (
            <label key={p.id} className={`pick ${on ? 'is-on' : ''} ${done ? 'is-done' : ''}`}>
              <input type="checkbox" checked={on} disabled={done} onChange={() => toggle(p.id)} />
              <span className="pick-box">{on && <CheckIcon width={14} height={14} />}</span>
              <span className="pick-number">{p.number}</span>
              <span className="pick-name">{p.name}</span>
              {done && <span className="muted small">Already has it</span>}
            </label>
          );
        })}
      </fieldset>

      <label className="field">
        <span className="field-label">Note for the player</span>
        <textarea
          className="textarea"
          rows={3}
          maxLength={1000}
          placeholder="What should they look for? e.g. “Watch your hedge on the screen.”"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {error && <p className="form-error">{error}</p>}

      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={busy || picked.size === 0}>
          {picked.size > 1 ? `Assign to ${picked.size} players` : 'Assign'}
        </button>
      </div>
    </Modal>
  );
}
