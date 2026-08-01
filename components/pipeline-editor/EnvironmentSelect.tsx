'use client'

import { useState } from 'react';
import type { Environment } from '@/lib/data/environments';
import Pill from '@/components/Pill';
import { usePipelineGraph } from './PipelineGraphProvider';
import styles from './environment-select.module.css';

interface EnvironmentSelectProps {
  environments: Environment[];
}

/*
 - Mirrors the selection into ?environment so it survives a refresh — the page reads it back server-side and seeds PipelineGraphProvider with it.

 - Uses the native history API rather than router.replace, since it reruns the server component (app/pipelines/[id]/page.tsx -- 4 queries) on every selection, and nothing here needs re-rendering. 
 - Use replaceState rather than pushState so if a user goes back in history, it does not walk through every environment the user tried.

 - When a user selects an environment, add it to the params. When a user deselects an environment, remove it from the params
*/
function syncEnvironmentParam(environmentId: string | null) {
  const params = new URLSearchParams(window.location.search);

  if (environmentId) params.set('environment', environmentId);
  else params.delete('environment');

  const query = params.toString();
  window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
}

export default function EnvironmentSelect({ environments }: EnvironmentSelectProps) {
  const { selectedEnvironmentId, setSelectedEnvironmentId } = usePipelineGraph();
  const selectedName = environments.find(env => env.id === selectedEnvironmentId)?.name ?? '';

  const [query, setQuery] = useState(selectedName);
  const [openMatches, setOpenMatches] = useState(false);

  const matches = () => {
    if (!query) return environments;
    const q = query.toLowerCase();
    return environments.filter(env => env.name.toLowerCase().includes(q));
  };

  const results = matches();

  return (
    <div className={styles.autocompleteWrapper}>
      <input
        type="text"
        placeholder="Select environment"
        autoComplete="off"
        className={styles.input}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedEnvironmentId(null);
          syncEnvironmentParam(null);
          setOpenMatches(true);
        }}
        onFocus={() => setOpenMatches(true)}
        onBlur={() => setTimeout(() => setOpenMatches(false), 100)}
      />
      {openMatches && environments.length > 0 && (
        <ul className={styles.autocompleteList}>
          {results.length > 0 ? (
            results.map(env => (
              <li key={env.id}>
                <button
                  type="button"
                  className={styles.autocompleteOption}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery(env.name);
                    setSelectedEnvironmentId(env.id);
                    syncEnvironmentParam(env.id);
                    setOpenMatches(false);
                  }}
                >
                  <span>{env.name}</span>
                  <Pill variant={env.type} label={env.type} />
                </button>
              </li>
            ))
          ) : environments.length > 0 ? (
            <li className={styles.autocompleteEmpty}>No matching environments</li>
          ) : 
            <li className={styles.autocompleteEmpty}>No environments created.</li>
          }
        </ul>
      )}
    </div>
  )
}
