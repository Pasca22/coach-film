import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { VIDEO_URL } from '../api';
import { formatTime } from '../lib/time';
import type { Team } from '../types';
import { BackIcon, ExpandIcon, ForwardIcon, PauseIcon, PlayIcon } from './icons';
import { Loading } from './ui';

export interface PlayerHandle {
  time(): number;
  duration(): number;
  seek(t: number): void;
  skip(delta: number): void;
  togglePlay(): void;
}

/** A window to play. `nonce` lets the same window be requested again (replay). */
export interface Segment {
  start: number;
  end: number;
  nonce: number;
}

export interface Marker {
  id: number;
  t: number;
  team: Team;
}

interface Props {
  ref?: Ref<PlayerHandle>;
  available: boolean | null;
  /** Seek to segment.start, play, and pause when segment.end is reached. */
  segment?: Segment | null;
  /** Restrict the timeline and playback to the segment (player view). */
  clipOnly?: boolean;
  markers?: Marker[];
  highlight?: { start: number; end: number } | null;
}

const RATES = [0.5, 1, 1.5, 2];

export function VideoPlayer({ ref, available, segment = null, clipOnly = false, markers = [], highlight = null }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stopAtRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);

  const clip = clipOnly && segment ? segment : null;
  const min = clip ? clip.start : 0;
  const max = clip ? clip.end : duration;

  const seek = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v) return;
      const hi = clip ? clip.end : v.duration || t;
      const next = Math.min(Math.max(t, clip ? clip.start : 0), hi);
      v.currentTime = next;
      setTime(next);
      // Coach view: leaving the requested segment cancels the auto-pause.
      if (!clip && segment && stopAtRef.current !== null && (next < segment.start || next >= segment.end)) {
        stopAtRef.current = null;
      }
    },
    [clip, segment],
  );

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused) {
      v.pause();
      return;
    }
    if (clip) {
      if (v.currentTime >= clip.end - 0.05 || v.currentTime < clip.start) v.currentTime = clip.start;
      stopAtRef.current = clip.end;
    }
    v.play().catch(() => {});
  }, [clip]);

  useImperativeHandle(
    ref,
    () => ({
      time: () => videoRef.current?.currentTime ?? 0,
      duration: () => videoRef.current?.duration || 0,
      seek,
      skip: (delta) => seek((videoRef.current?.currentTime ?? 0) + delta),
      togglePlay,
    }),
    [seek, togglePlay],
  );

  // A new segment request: jump to its start and play it.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !segment) return;
    const start = () => {
      v.currentTime = segment.start;
      setTime(segment.start);
      stopAtRef.current = segment.end;
      v.play().catch(() => {}); // autoplay can be blocked before the first user gesture
    };
    if (v.readyState >= 1) {
      start();
      return;
    }
    v.addEventListener('loadedmetadata', start, { once: true });
    return () => v.removeEventListener('loadedmetadata', start);
  }, [segment, available]);

  // While playing, track time every frame and stop exactly at the segment end.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        const stopAt = stopAtRef.current;
        if (stopAt !== null && v.currentTime >= stopAt) {
          v.pause();
          if (!clip) stopAtRef.current = null;
        }
        setTime(v.currentTime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, clip]);

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    if (videoRef.current) videoRef.current.playbackRate = next;
    setRate(next);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapRef.current?.requestFullscreen?.();
  };

  if (available === null) {
    return (
      <div className="player player-empty">
        <Loading />
      </div>
    );
  }
  if (!available) {
    return (
      <div className="player player-empty">
        <div className="player-missing">
          <p className="player-missing-title">No match video yet</p>
          <p>
            Put your video at <code>video/match.mp4</code> inside the project folder, then reload.
          </p>
        </div>
      </div>
    );
  }

  const span = max - min;
  const pct = (t: number) => (span > 0 ? Math.min(100, Math.max(0, ((t - min) / span) * 100)) : 0);

  return (
    <div className="player" ref={wrapRef}>
      <div className="player-frame">
        <video
          ref={videoRef}
          src={VIDEO_URL}
          preload="metadata"
          playsInline
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => !playing && setTime(e.currentTarget.currentTime)}
        />
      </div>

      <div className="player-controls">
        <div className="timeline">
          <div className="timeline-track">
            {highlight && !clip && (
              <div
                className="timeline-highlight"
                style={{ left: `${pct(highlight.start)}%`, width: `${Math.max(0.4, pct(highlight.end) - pct(highlight.start))}%` }}
              />
            )}
            <div className="timeline-progress" style={{ width: `${pct(time)}%` }} />
            {!clip &&
              markers.map((m) => <span key={m.id} className={`timeline-marker marker-${m.team}`} style={{ left: `${pct(m.t)}%` }} />)}
          </div>
          <input
            type="range"
            className="timeline-input"
            min={min}
            max={max || 0}
            step={0.1}
            value={Math.min(Math.max(time, min), max || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
          />
        </div>

        <div className="player-buttons">
          <button className="icon-btn icon-btn-solid" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button className="icon-btn" onClick={() => seek(time - 5)} aria-label="Back 5 seconds" title="Back 5s">
            <BackIcon />
          </button>
          <button className="icon-btn" onClick={() => seek(time + 5)} aria-label="Forward 5 seconds" title="Forward 5s">
            <ForwardIcon />
          </button>
          <span className="player-time">
            {formatTime(clip ? time - clip.start : time)} <span className="muted">/ {formatTime(clip ? clip.end - clip.start : duration)}</span>
          </span>
          <span className="spacer" />
          <button className="pill-btn" onClick={cycleRate} aria-label="Playback speed">
            {rate}×
          </button>
          <button className="icon-btn" onClick={toggleFullscreen} aria-label="Fullscreen">
            <ExpandIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
