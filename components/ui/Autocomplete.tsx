"use client"

import { useState } from 'react';
import styles from './autocomplete.module.css';

export interface AutocompleteOption {
  id: string;
  name: string;
  detail?: string | null;
}

interface AutocompleteProps {
  id: string;
  idName: string;
  textName?: string;
  placeholder: string;
  emptyText: string;
  options: AutocompleteOption[];
  initialId?: string | null;
  initialName?: string | null;
  required?: boolean;
  /** Called with the id that would now be submitted (null when none), whenever it changes by the user's hand. */
  onSelect?: (id: string | null) => void;
}

/*
 * Picks one record by name and submits its id through a hidden input named `idName`.
 * Typing a name in full counts as picking it, unless two options share that name.
 * `textName` also submits the raw text, for an action that must tell "left empty" from
 * "typed something that matched nothing".
 */
export default function Autocomplete({
  id,
  idName,
  textName,
  placeholder,
  emptyText,
  options,
  initialId,
  initialName,
  required = false,
  onSelect,
}: AutocompleteProps) {
  const [query, setQuery] = useState(initialName ?? '');
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);
  const [openMatches, setOpenMatches] = useState(false);


  const matches = () => {
    if (!query) return [];
    const q = query.toLowerCase();
    return options.filter(o => o.name.toLowerCase().includes(q));
  }


  const exactMatch = (text = query) => {
    const q = text.trim().toLowerCase();
    const found = options.filter(o => o.name.toLowerCase() === q);
    return found.length === 1 ? found[0] : undefined;
  }


  const handleBlur = () => {
    const match = exactMatch();
    if (!selectedId && match) {
      setQuery(match.name);
      setSelectedId(match.id);
      onSelect?.(match.id);
    }
    setTimeout(() => setOpenMatches(false), 100);
  }


  return (
    <>
      <input type="hidden" name={idName} value={selectedId ?? exactMatch()?.id ?? ''} />
      <div className={styles.autocompleteWrapper}>
        <input
          type="text"
          id={id}
          name={textName}
          placeholder={placeholder}
          autoComplete="off"
          value={query}
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(null);
            setOpenMatches(true);
            // A name typed in full is what the hidden input submits, so it counts as a pick.
            onSelect?.(exactMatch(e.target.value)?.id ?? null);
          }}
          onFocus={() => setOpenMatches(true)}
          onBlur={handleBlur}
          required={required}
        />
        {openMatches && query && (
          <ul className={styles.autocompleteList}>
            {matches().length > 0 ? (
              matches().map(o => (
                <li key={o.id}>
                  <button
                    type="button"
                    className={styles.autocompleteOption}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setQuery(o.name);
                      setSelectedId(o.id);
                      setOpenMatches(false);
                      onSelect?.(o.id);
                    }}
                  >
                    <span>{o.name}</span>
                    <span className={styles.autocompleteMuted}>{o.detail}</span>
                  </button>
                </li>
              ))
            ) : (
              <li className={styles.autocompleteEmpty}>{emptyText}</li>
            )}
          </ul>
        )}
      </div>
    </>
  );
}
