'use client'

import { useState } from 'react';
import type { Environment } from '@/lib/data/environments';
import Pill from '@/components/Pill';
import { usePipelineGraph } from './PipelineGraphProvider';
import styles from './environment-select.module.css';

interface EnvironmentSelectProps {
  environments: Environment[];
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
          setOpenMatches(true);
        }}
        onFocus={() => setOpenMatches(true)}
        onBlur={() => setTimeout(() => setOpenMatches(false), 100)}
      />
      {openMatches && environments.length > 0 && (
        <ul className={styles.autocompleteList}>
          {matches().length > 0 ? (
            matches().map(env => (
              <li key={env.id}>
                <button
                  type="button"
                  className={styles.autocompleteOption}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery(env.name);
                    setSelectedEnvironmentId(env.id);
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
