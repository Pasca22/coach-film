import type { ReactNode } from 'react';
import type { Assignment } from '../types';
import { typeLabel } from '../types';
import { formatLength, formatRange, formatWhen } from '../lib/time';
import { TeamChip } from './ui';

interface Props {
  assignment: Assignment;
  active?: boolean;
  onOpen?: () => void;
  children?: ReactNode; // extra actions
}

/** One assigned clip: type, team, time window, coach note and watched state. */
export function ClipCard({ assignment: a, active, onOpen, children }: Props) {
  const watched = a.watched_at !== null;
  const body = (
    <>
      <div className="clip-card-top">
        <span className="clip-card-type">{typeLabel(a.event.type)}</span>
        <TeamChip team={a.event.team} />
        <span className="spacer" />
        <span className={`status ${watched ? 'status-done' : 'status-new'}`}>
          {watched ? `Watched ${formatWhen(a.watched_at!)}` : 'Not watched'}
        </span>
      </div>
      <div className="clip-card-time">
        {formatRange(a.event.start_s, a.event.end_s)} <span className="muted">· {formatLength(a.event.start_s, a.event.end_s)}</span>
      </div>
      {a.note && <p className="clip-card-note">{a.note}</p>}
    </>
  );

  return (
    <article className={`clip-card ${active ? 'is-active' : ''} ${watched ? 'is-watched' : ''}`}>
      {onOpen ? (
        <button className="clip-card-main" onClick={onOpen}>
          {body}
        </button>
      ) : (
        <div className="clip-card-main">{body}</div>
      )}
      {children && <div className="clip-card-actions">{children}</div>}
    </article>
  );
}
