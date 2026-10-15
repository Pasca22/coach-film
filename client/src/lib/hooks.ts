import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';

/** Wide screens get the coach workstation; narrow ("mobile") screens get the review views. */
export const WIDE_QUERY = '(min-width: 900px)';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export const useIsWide = () => useMediaQuery(WIDE_QUERY);

/** null while checking, then whether video/match.mp4 exists on the server. */
export function useVideoAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    api.videoStatus().then((s) => setAvailable(s.available), () => setAvailable(false));
  }, []);
  return available;
}

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setMessage(text);
    timer.current = window.setTimeout(() => setMessage(null), 2600);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { message, show };
}
