import { useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '../api';
import { ClipCard } from '../components/ClipCard';
import { PlayIcon, TrashIcon } from '../components/icons';
import { EmptyState, LoadError, Loading, Modal, Toast } from '../components/ui';
import { VideoPlayer } from '../components/VideoPlayer';
import { useToast, useVideoAvailable } from '../lib/hooks';
import { typeLabel, type Assignment, type Player } from '../types';

/** Coach overview: everything assigned, grouped by player. Works on desktop and phone widths. */
export function AssignmentsPage() {
  const available = useVideoAvailable();
  const { message, show } = useToast();
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<Assignment | null>(null);
  const [editing, setEditing] = useState<{ id: number; note: string } | null>(null);

  useEffect(() => {
    Promise.all([api.players(), api.assignments()]).then(
      ([p, a]) => {
        setPlayers(p);
        setAssignments(a);
      },
      (err) => setError(errorMessage(err)),
    );
  }, []);

  const groups = useMemo(
    () =>
      (players ?? [])
        .map((player) => ({ player, items: assignments.filter((a) => a.player_id === player.id) }))
        .filter((g) => g.items.length > 0),
    [players, assignments],
  );

  const replace = (updated: Assignment) => setAssignments((list) => list.map((a) => (a.id === updated.id ? updated : a)));

  const saveNote = async () => {
    if (!editing) return;
    try {
      replace(await api.updateAssignment(editing.id, { note: editing.note }));
      setEditing(null);
      show('Note saved');
    } catch (err) {
      show(errorMessage(err));
    }
  };

  const remove = async (a: Assignment, player: Player) => {
    if (!window.confirm(`Remove this ${typeLabel(a.event.type)} clip from ${player.name}?`)) return;
    try {
      await api.deleteAssignment(a.id);
      setAssignments((list) => list.filter((x) => x.id !== a.id));
      show('Clip removed');
    } catch (err) {
      show(errorMessage(err));
    }
  };

  if (error) return <LoadError message={error} />;
  if (!players) return <Loading />;

  const watchedCount = assignments.filter((a) => a.watched_at).length;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Assignments</h1>
        <p className="muted">
          {assignments.length} clip{assignments.length === 1 ? '' : 's'} sent · {watchedCount} watched
        </p>
      </header>

      {groups.length === 0 ? (
        <EmptyState title="Nothing assigned yet">Select an event in the workstation and press Assign.</EmptyState>
      ) : (
        <div className="groups">
          {groups.map(({ player, items }) => {
            const done = items.filter((a) => a.watched_at).length;
            return (
              <section key={player.id} className="group">
                <header className="group-head">
                  <span className="who-avatar who-avatar-sm">{player.number}</span>
                  <h2>{player.name}</h2>
                  <span className="spacer" />
                  <span className="muted small">
                    {done}/{items.length} watched
                  </span>
                  <span className="progress" aria-hidden="true">
                    <span style={{ width: `${(done / items.length) * 100}%` }} />
                  </span>
                </header>
                <div className="clip-grid">
                  {items.map((a) => (
                    <ClipCard key={a.id} assignment={a}>
                      {editing?.id === a.id ? (
                        <div className="note-edit">
                          <textarea
                            className="textarea"
                            rows={3}
                            maxLength={1000}
                            value={editing.note}
                            autoFocus
                            onChange={(e) => setEditing({ id: a.id, note: e.target.value })}
                          />
                          <div className="row-actions">
                            <button className="btn btn-sm" onClick={() => setEditing(null)}>
                              Cancel
                            </button>
                            <button className="btn btn-sm btn-primary" onClick={saveNote}>
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="row-actions">
                          <button className="btn btn-sm" onClick={() => setPlaying(a)}>
                            <PlayIcon width={16} height={16} /> Play
                          </button>
                          <button className="btn btn-sm" onClick={() => setEditing({ id: a.id, note: a.note })}>
                            {a.note ? 'Edit note' : 'Add note'}
                          </button>
                          <span className="spacer" />
                          <button className="icon-btn" onClick={() => remove(a, player)} aria-label="Remove clip">
                            <TrashIcon width={18} height={18} />
                          </button>
                        </div>
                      )}
                    </ClipCard>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {playing && <ClipModal clip={playing} available={available} onClose={() => setPlaying(null)} />}
      <Toast message={message} />
    </div>
  );
}

function ClipModal({ clip, available, onClose }: { clip: Assignment; available: boolean | null; onClose: () => void }) {
  // Stable segment object: a new one would restart playback.
  const segment = useMemo(
    () => ({ start: clip.event.start_s, end: clip.event.end_s, nonce: clip.id }),
    [clip.event.start_s, clip.event.end_s, clip.id],
  );
  return (
    <Modal title={typeLabel(clip.event.type)} onClose={onClose} wide>
      <VideoPlayer available={available} clipOnly segment={segment} />
      {clip.note && <p className="note-callout">{clip.note}</p>}
    </Modal>
  );
}
