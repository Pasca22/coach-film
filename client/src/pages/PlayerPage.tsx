import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { api, errorMessage } from '../api';
import { ClipCard } from '../components/ClipCard';
import { CheckIcon, ChevronLeftIcon } from '../components/icons';
import { EmptyState, LoadError, Loading, TeamChip, Toast } from '../components/ui';
import { VideoPlayer, type Segment } from '../components/VideoPlayer';
import { useIsWide, useToast, useVideoAvailable } from '../lib/hooks';
import { formatRange, formatWhen } from '../lib/time';
import { typeLabel, type Assignment, type Player } from '../types';

/** A player's own clips — nothing else. List + viewer on desktop, list → viewer on phone. */
export function PlayerPage() {
  const id = Number(useParams().id);
  const isWide = useIsWide();
  const available = useVideoAvailable();
  const { message, show } = useToast();
  const [player, setPlayer] = useState<Player | null | undefined>(undefined);
  const [clips, setClips] = useState<Assignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    setPlayer(undefined);
    setOpenId(null);
    Promise.all([api.players(), api.assignments(id)]).then(
      ([all, mine]) => {
        setPlayer(all.find((p) => p.id === id && p.team === 'us') ?? null);
        setClips(mine);
      },
      (err) => setError(errorMessage(err)),
    );
  }, [id]);

  // Desktop: open the first unwatched clip (or the first clip) automatically.
  useEffect(() => {
    if (isWide && openId === null && clips.length) setOpenId((clips.find((c) => !c.watched_at) ?? clips[0]).id);
  }, [isWide, clips, openId]);

  const open = clips.find((c) => c.id === openId) ?? null;
  // Only a different clip should restart playback, not a watched toggle.
  const segment = useMemo<Segment | null>(
    () => (open ? { start: open.event.start_s, end: open.event.end_s, nonce: open.id } : null),
    [open?.id, open?.event.start_s, open?.event.end_s],
  );

  const setWatched = async (clip: Assignment, watched: boolean) => {
    try {
      const updated = await api.updateAssignment(clip.id, { watched });
      setClips((list) => list.map((c) => (c.id === updated.id ? updated : c)));
      if (watched) show('Marked as watched');
    } catch (err) {
      show(errorMessage(err));
    }
  };

  if (error) return <LoadError message={error} />;
  if (player === undefined) return <Loading />;
  if (player === null) {
    return (
      <div className="page">
        <EmptyState title="Player not found">Go back and pick who you are.</EmptyState>
      </div>
    );
  }

  const unwatched = clips.filter((c) => !c.watched_at).length;
  const showList = isWide || !open;

  return (
    <div className={`page player-page ${isWide ? 'is-wide' : ''}`}>
      {showList && (
        <section className="player-list">
          <header className="page-head">
            <p className="eyebrow">
              #{player.number} · {player.name}
            </p>
            <h1>Your clips</h1>
            <p className="muted">
              {clips.length === 0
                ? 'Nothing here yet.'
                : `${clips.length} clip${clips.length === 1 ? '' : 's'} · ${unwatched ? `${unwatched} to watch` : 'all watched'}`}
            </p>
          </header>
          {clips.length === 0 ? (
            <EmptyState title="Nothing assigned yet">When your coach sends you clips, they show up here.</EmptyState>
          ) : (
            <div className="clip-stack">
              {clips.map((c) => (
                <ClipCard key={c.id} assignment={c} active={c.id === openId} onOpen={() => setOpenId(c.id)} />
              ))}
            </div>
          )}
        </section>
      )}

      {open && (
        <section className="player-viewer">
          {!isWide && (
            <button className="link-btn back-btn" onClick={() => setOpenId(null)}>
              <ChevronLeftIcon width={18} height={18} /> All clips
            </button>
          )}
          <VideoPlayer available={available} clipOnly segment={segment} />
          <div className="viewer-meta">
            <div className="viewer-title">
              <h2>{typeLabel(open.event.type)}</h2>
              <TeamChip team={open.event.team} />
              <span className="muted small">{formatRange(open.event.start_s, open.event.end_s)}</span>
            </div>
            {open.note ? (
              <div className="note-callout">
                <span className="field-label">From your coach</span>
                <p>{open.note}</p>
              </div>
            ) : (
              <p className="muted">No note from your coach for this clip.</p>
            )}
            {open.watched_at ? (
              <div className="watched-row">
                <span className="status status-done">
                  <CheckIcon width={14} height={14} /> Watched {formatWhen(open.watched_at)}
                </span>
                <button className="link-btn" onClick={() => setWatched(open, false)}>
                  Mark as not watched
                </button>
              </div>
            ) : (
              <button className="btn btn-primary btn-block" onClick={() => setWatched(open, true)}>
                <CheckIcon /> Mark as watched
              </button>
            )}
          </div>
        </section>
      )}
      <Toast message={message} />
    </div>
  );
}
