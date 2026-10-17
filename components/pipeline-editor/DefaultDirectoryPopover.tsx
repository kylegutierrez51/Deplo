'use client'

import { useEffect, useRef, useState } from 'react';
import { usePipelineGraph } from './PipelineGraphProvider';
import styles from './default-directory-popover.module.css';

/*
 - Lives behind an icon button rather than as an input in the header bar: at laptop widths the bar has
   no room for a second input beside EnvironmentSelect, and it pushed Save and Run off-screen.
 - The value is editor state like the graph, so it is saved by the header's Save button, not here.
 - Dismissal follows FilterListbox: a pointerdown outside closes it without moving focus, Escape closes
   it and returns focus to the trigger.
*/
export default function DefaultDirectoryPopover() {
  const { defaultDirectory, setDefaultDirectory } = usePipelineGraph();
  const [open, setOpen] = useState(false);

  const groupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const directory = defaultDirectory.trim();

  useEffect(() => {
    if (!open) return;

    inputRef.current?.focus();

    const onPointerDown = (event: Event) => {
      if (!groupRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const closeAndFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={groupRef}
      className={styles.group}
      onKeyDown={e => { if (open && e.key === 'Escape') closeAndFocus(); }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label="Default directory"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={directory ? `Default directory: ${directory}` : 'No default directory'}
        className={`${styles.trigger}${directory ? ` ${styles.set}` : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <ion-icon name={directory ? 'folder' : 'folder-outline'}></ion-icon>
      </button>

      {open && (
        <div role="dialog" aria-label="Default directory" className={styles.popover}>
          <label htmlFor="default-directory">DEFAULT DIRECTORY</label>
          <input
            ref={inputRef}
            id="default-directory"
            type="text"
            placeholder="e.g. /srv/app"
            autoComplete="off"
            spellCheck={false}
            className={styles.input}
            value={defaultDirectory}
            onChange={e => setDefaultDirectory(e.target.value.replaceAll('"', ''))}
          />
          <p className={styles.hint}>Stages without their own directory run here. Saved with the pipeline.</p>
        </div>
      )}
    </div>
  )
}
