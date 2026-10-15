import { useEffect, useMemo, useRef, useState } from 'react';
import { api, errorMessage } from '../api';
import { AssignDialog } from '../components/AssignDialog';
import { EventFilterBar } from '../components/EventFilterBar';
import { EventList } from '../components/EventList';
import { TagBar } from '../components/TagBar';
import { EmptyState, Kbd, LoadError, Loading, Toast } from '../components/ui';
import { VideoPlayer, type PlayerHandle, type Segment } from '../components/VideoPlayer';
import { filterEvents, hasFilters, NO_FILTERS, type EventFilters } from '../lib/filter';
import { useToast, useVideoAvailable } from '../lib/hooks';
import { formatTime, roundTime, tagWindow } from '../lib/time';
import {
  EVENT_TYPES,
  teamLabel,
  typeLabel,
  type Assignment,
  type EventInput,
  type EventType,
  type MatchEvent,
  type Player,
  type Team,
} from '../types';

const byStart = (a: MatchEvent, b: MatchEvent) => a.start_s - b.start_s || a.id - b.id;

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

export function CoachWorkstation() {
  const available = useVideoAvailable();
  const playerRef = useRef<PlayerHandle>(null);
  const { message, show } = useToast();

  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [segment, setSegment] = useState<Segment | null>(null);
  const [tagTeam, setTagTeam] = useState<Team>('us');
  const [tagPlayer, setTagPlayer] = useState<number | null>(null);
  const [filters, setFilters] = useState<EventFilters>(NO_FILTERS);
  const [assigning, setAssigning] = useState<MatchEvent | null>(null);

  useEffect(() => {
    Promise.all([api.players(), api.events(), api.assignments()]).then(
      ([p, e, a]) => {
        setPlayers(p);
        setEvents(e);
        setAssignments(a);
        setLoaded(true);
      },
      (err) => setLoadError(errorMessage(err)),
    );
  }, []);

  const visible = useMemo(() => filterEvents(events, filters), [events, filters]);
  const selected = events.find((e) => e.id === selectedId) ?? null;

  const assignedTo = useMemo(() => {
    const map = new Map<number, Player[]>();
    for (const a of assignments) {
      const p = players.find((x) => x.id === a.player_id);
      if (p) map.set(a.event_id, [...(map.get(a.event_id) ?? []), p]);
    }
    return map;
  }, [assignments, players]);

  // ---------- actions ----------

  const replaceEvent = (updated: MatchEvent) => {
    setEvents((list) => list.map((e) => (e.id === updated.id ? updated : e)).sort(byStart));
    // Keep the copies of the event embedded in assignments in sync.
    setAssignments((list) =>
      list.map((a) =>
        a.event_id === updated.id
          ? { ...a, event: { type: updated.type, team: updated.team, player_id: updated.player_id, start_s: updated.start_s, end_s: updated.end_s } }
          : a,
      ),
    );
  };

  const tag = async (type: EventType) => {
    const p = playerRef.current;
    if (!p || !available) return;
    const t = p.time();
    try {
      const created = await api.createEvent({ type, team: tagTeam, player_id: tagPlayer, ...tagWindow(t, p.duration()) });
      setEvents((list) => [...list, created].sort(byStart));
      setSelectedId(created.id);
      setTagPlayer(null);
      show(`Tagged ${typeLabel(type)} · ${teamLabel(tagTeam)} · ${formatTime(t)}`);
    } catch (err) {
      show(errorMessage(err));
    }
  };

  const update = async (event: MatchEvent, patch: Partial<EventInput>) => {
    try {
      replaceEvent(await api.updateEvent(event.id, patch));
    } catch (err) {
      show(errorMessage(err));
    }
  };

  const setEdge = (edge: 'start' | 'end') => {
    const p = playerRef.current;
    if (!selected || !p) return;
    const t = roundTime(p.time());
    if (edge === 'start' && t >= selected.end_s) return show('Start must be before the end — move the end first');
    if (edge === 'end' && t <= selected.start_s) return show('End must be after the start');
    update(selected, edge === 'start' ? { start_s: t } : { end_s: t });
  };

  const play = (event: MatchEvent) => {
    setSelectedId(event.id);
    setSegment({ start: event.start_s, end: event.end_s, nonce: Date.now() });
  };

  const remove = async (event: MatchEvent) => {
    const n = assignedTo.get(event.id)?.length ?? 0;
    const warning = n ? `\n\nIt was sent to ${n} player${n > 1 ? 's' : ''}; they will lose this clip.` : '';
    if (!window.confirm(`Delete this ${typeLabel(event.type)} at ${formatTime(event.start_s)}?${warning}`)) return;
    try {
      await api.deleteEvent(event.id);
      setEvents((list) => list.filter((e) => e.id !== event.id));
      setAssignments((list) => list.filter((a) => a.event_id !== event.id));
      if (selectedId === event.id) setSelectedId(null);
      show('Event deleted');
    } catch (err) {
      show(errorMessage(err));
    }
  };

  // ---------- hotkeys ----------

  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  onKey.current = (e: KeyboardEvent) => {
    if (assigning || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const p = playerRef.current;
    const type = EVENT_TYPES.find((t) => t.key === e.key)?.type;
    if (type) tag(type);
    else if (e.key === 't' || e.key === 'T') setTagTeam((t) => (t === 'us' ? 'opponent' : 'us'));
    else if (e.key === '[') setEdge('start');
    else if (e.key === ']') setEdge('end');
    else if (e.key === ' ' && p) p.togglePlay();
    else if (e.key === 'ArrowLeft' && p) p.skip(e.shiftKey ? -1 : -5);
    else if (e.key === 'ArrowRight' && p) p.skip(e.shiftKey ? 1 : 5);
    else if (e.key === 'Escape') setSelectedId(null);
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Reset the tag player when the team changes so a player never ends up on the wrong team.
  useEffect(() => setTagPlayer(null), [tagTeam]);

  if (loadError) return <LoadError message={loadError} />;

  return (
    <div className="workstation">
      <section className="ws-main">
        <VideoPlayer
          ref={playerRef}
          available={available}
          segment={segment}
          markers={visible.map((e) => ({ id: e.id, t: e.start_s, team: e.team }))}
          highlight={selected ? { start: selected.start_s, end: selected.end_s } : null}
        />
        <TagBar
          players={players}
          team={tagTeam}
          playerId={tagPlayer}
          disabled={!available}
          onTeam={setTagTeam}
          onPlayer={setTagPlayer}
          onTag={tag}
        />
        <p className="hotkeys muted small">
          <Kbd>Space</Kbd> play/pause · <Kbd>←</Kbd>
          <Kbd>→</Kbd> 5s (<Kbd>Shift</Kbd> 1s) · <Kbd>1</Kbd>–<Kbd>4</Kbd> tag · <Kbd>T</Kbd> team · <Kbd>[</Kbd>
          <Kbd>]</Kbd> set start/end · <Kbd>Esc</Kbd> deselect
        </p>
      </section>

      <aside className="ws-side" aria-label="Events">
        <div className="panel-head">
          <h2>Events</h2>
          <span className="muted small">
            {hasFilters(filters) ? `${visible.length} of ${events.length}` : events.length}
          </span>
        </div>
        <EventFilterBar players={players} filters={filters} onChange={setFilters} />
        <div className="ws-list">
          {!loaded ? (
            <Loading />
          ) : events.length === 0 ? (
            <EmptyState title="No events yet">
              Play the match and press <Kbd>1</Kbd>–<Kbd>4</Kbd> when something happens.
            </EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState title="Nothing matches these filters" />
          ) : (
            <EventList
              events={visible}
              players={players}
              assignedTo={assignedTo}
              selectedId={selectedId}
              onSelect={play}
              onChange={update}
              onSetEdge={setEdge}
              onReplay={play}
              onAssign={setAssigning}
              onDelete={remove}
            />
          )}
        </div>
      </aside>

      {assigning && (
        <AssignDialog
          event={assigning}
          players={players}
          assignments={assignments}
          onClose={() => setAssigning(null)}
          onAssigned={(created, options) => {
            setAssignments((list) => [...created, ...list]);
            if (options?.keepOpen) return;
            setAssigning(null);
            show(`Sent to ${created.length} player${created.length > 1 ? 's' : ''}`);
          }}
        />
      )}
      <Toast message={message} />
    </div>
  );
}
