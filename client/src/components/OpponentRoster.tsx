import { useState, type FormEvent } from 'react';
import { playerLabel, type Opponent } from '../types';
import { CloseIcon } from './icons';

interface Props {
  opponents: Opponent[];
  onAdd: (input: { number: number; name: string }) => Promise<boolean>;
  onRemove: (opponent: Opponent) => void;
}

/** The opposing players for this game. The coach adds them as they become relevant. */
export function OpponentRoster({ opponents, onAdd, onRemove }: Props) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (number.trim() === '') return;
    if (await onAdd({ number: Number(number), name })) {
      setNumber('');
      setName('');
    }
  };

  return (
    <div className="opp-roster">
      <span className="field-label">Opponents this game</span>
      <div className="opp-roster-body">
        {opponents.map((o) => (
          <span key={o.id} className="opp-chip">
            {playerLabel(o)}
            <button onClick={() => onRemove(o)} aria-label={`Remove opponent ${playerLabel(o)}`}>
              <CloseIcon width={12} height={12} />
            </button>
          </span>
        ))}
        <form className="opp-add" onSubmit={submit}>
          <input
            className="input input-num"
            inputMode="numeric"
            placeholder="#"
            aria-label="Opponent jersey number"
            value={number}
            maxLength={2}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
          />
          <input
            className="input"
            placeholder="Name (optional)"
            aria-label="Opponent name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-sm" type="submit" disabled={number === ''}>
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
