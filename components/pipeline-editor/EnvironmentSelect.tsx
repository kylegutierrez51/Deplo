'use client'

import { useState } from 'react';
import type { Environment } from '@/lib/data/environments';
import Pill from '@/components/ui/Pill';
import { usePipelineGraph } from './PipelineGraphProvider';
import { NO_ENVIRONMENT } from '@/lib/pipeline/environment-param';
import styles from './environment-select.module.css';

interface EnvironmentSelectProps {
  environments: Environment[];
  defaultEnvironmentId: string | null;
}

/*
 - Mirrors the selection into ?environment so it survives a refresh — the page reads it back server-side and seeds PipelineGraphProvider with it.

 - Uses the native history API rather than router.replace, since it reruns the server component (app/pipelines/[id]/page.tsx -- 4 queries) on every selection, and nothing here needs re-rendering. 
 - Use replaceState rather than pushState so if a user goes back in history, it does not walk through every environment the user tried.

 - When a user deselects an environment, write NO_ENVIRONMENT (`?environment=none`).
*/
function syncEnvironmentParam(environmentId: string | null) {
  const params = new URLSearchParams(window.location.search);

  params.set('environment', environmentId ?? NO_ENVIRONMENT);

  const query = params.toString();
  window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
}

export default function EnvironmentSelect({ environments, defaultEnvironmentId }: EnvironmentSelectProps) {
  const { selectedEnvironmentId, setSelectedEnvironmentId, nodes } = usePipelineGraph();
  const selectedName = environments.find(env => env.id === selectedEnvironmentId)?.name ?? '';

  const [query, setQuery] = useState(selectedName);
  const [openMatches, setOpenMatches] = useState(false);

  const matches = () => {
    if (!query) return environments;
    const q = query.toLowerCase();
    return environments.filter(env => env.name.toLowerCase().includes(q));
  };

  const results = matches();

  /* If a node has secrets for an environment, but a user has no environment selected, 
   * display a small warning on the header */
  const withSecrets = selectedEnvironmentId ? [] : nodes.filter(node =>
    Object.values(node.data.secrets ?? {}).some(ids => ids.length));

  const unusedSecretsHint = withSecrets.length
    ? `You do not have an environment selected, so these nodes have secrets that won't be used: ${withSecrets.map(node => node.data.name?.trim() || 'unnamed stage').join(', ')}`
    : null;

  return (
    <div className={styles.autocompleteWrapper}>
      {unusedSecretsHint && (
        <span id="unused-secrets-hint" role="img" aria-label={unusedSecretsHint} title={unusedSecretsHint} className={styles.unusedSecretsHint}>
          <ion-icon name="alert-circle-outline"></ion-icon>
        </span>
      )}
      <input
        type="text"
        aria-describedby={unusedSecretsHint ? 'unused-secrets-hint' : undefined}
        placeholder="Select environment"
        autoComplete="off"
        className={`${styles.input}${unusedSecretsHint ? ` ${styles.inputWithHint}` : ''}`}
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
                  <span>
                    {env.name}
                    {env.id === defaultEnvironmentId && <span className={styles.defaultBadge}>default</span>}
                  </span>
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
