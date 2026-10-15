// No auth in this demo: we only remember who picked last, to highlight it on the picker.
const KEY = 'coach-film.identity';

export type Identity = 'coach' | `player:${number}`;

export function getIdentity(): Identity | null {
  try {
    return (localStorage.getItem(KEY) as Identity | null) ?? null;
  } catch {
    return null;
  }
}

export function setIdentity(identity: Identity) {
  try {
    localStorage.setItem(KEY, identity);
  } catch {
    // storage unavailable (private mode) — the picker still works
  }
}
