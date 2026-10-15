import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, errorMessage } from '../api';
import { getIdentity, setIdentity, type Identity } from '../lib/identity';
import { LoadError } from '../components/ui';
import type { Player } from '../types';

export function WhoPage() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const last = getIdentity();

  useEffect(() => {
    api.players().then(setPlayers, (err) => setError(errorMessage(err)));
  }, []);

  const go = (identity: Identity, path: string) => {
    setIdentity(identity);
    navigate(path);
  };

  if (error) return <LoadError message={error} />;

  return (
    <div className="page who">
      <header className="who-head">
        <p className="eyebrow">Match review</p>
        <h1>Who's watching?</h1>
        <p className="muted">No login in this demo — pick who you are.</p>
      </header>

      <div className="who-grid">
        <button className="who-card who-card-coach" onClick={() => go('coach', '/coach')}>
          <span className="who-avatar">C</span>
          <span className="who-name">Coach</span>
          <span className="who-role">Tag, cut and assign clips</span>
          {last === 'coach' && <span className="who-last">Last used</span>}
        </button>
        {players?.map((p) => (
          <button key={p.id} className="who-card" onClick={() => go(`player:${p.id}`, `/player/${p.id}`)}>
            <span className="who-avatar">{p.number}</span>
            <span className="who-name">{p.name}</span>
            <span className="who-role">Player</span>
            {last === `player:${p.id}` && <span className="who-last">Last used</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
