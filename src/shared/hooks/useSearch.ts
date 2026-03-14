import { useState, useMemo } from 'react';
import type { Session } from '@core/types/session.types';
import { searchSessions } from '@core/services/search.service';
import { debounce } from '@core/utils/debounce';

export function useSearch(sessions: Session[]) {
  const [query, setQuery] = useState('');

  const debouncedSetQuery = useMemo(() => debounce((q: unknown) => setQuery(q as string), 300), []);

  const filteredSessions = useMemo(() => {
    return searchSessions(sessions, query);
  }, [sessions, query]);

  return {
    query,
    setQuery: debouncedSetQuery,
    setQueryImmediate: setQuery,
    filteredSessions,
  };
}
