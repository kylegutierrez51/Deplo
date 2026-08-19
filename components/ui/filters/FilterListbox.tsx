'use client';

import { useEffect, useRef, useState } from 'react';
import Pill, { type PillVariant } from '@/components/ui/Pill';
import { capitalize } from '@/lib/utils/string';
import own from './filter-listbox.module.css';

export interface FilterListboxOption {
  value: string;
  label: string;
  status?: PillVariant;
}

interface FilterListboxProps {
  id: string;
  name: string;
  options: FilterListboxOption[];
  setFilteredOption: (value: string) => void;
  defaultValue?: string;
  styles?: Record<string, string>;
  responsive?: boolean;
}


function pillLabel(status: PillVariant): string {
  return status === 'awaiting-approval' ? 'Awaiting' : capitalize(status);
}


export default function FilterListbox({
  id,
  name,
  options,
  setFilteredOption,
  defaultValue,
  styles = own,
  responsive = true,
}: FilterListboxProps) {
  const [selected, setSelected] = useState(
    () => options.find((option) => option.value === defaultValue)?.value ?? options[0]?.value ?? '',
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const groupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((option) => option.value === selected) ?? options[0];
  const selectedValue = selectedOption?.value ?? '';
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === selectedValue));

  const listboxId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;

  /*
   * A pointer that lands outside dismisses the popup. pointerdown rather than
   * click so the popup is gone before the thing underneath reacts, and the
   * trigger is inside groupRef so its own toggle still runs.
   */
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: Event) => {
      if (!groupRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const openList = () => {
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  /* Escape and a committed choice both return the caret to the trigger; an outside click does not. */
  const closeAndFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const commit = (index: number) => {
    const option = options[index];
    if (option) {
      setSelected(option.value);
      setFilteredOption(option.value);
    } 
    closeAndFocus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        commit(activeIndex);
        break;
      case 'Escape':
        event.preventDefault();
        closeAndFocus();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div
      ref={groupRef}
      className={`${styles['select-group']}${responsive && styles.responsive ? ` ${styles.responsive}` : ''}`}
    >

      <input type="hidden" name={name} value={selectedValue} readOnly />

      <div
        ref={triggerRef}
        id={id}
        role="combobox"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        className={own.trigger}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={own['trigger-label']}>{selectedOption?.label}</span>
        {selectedOption?.status && (
          <Pill variant={selectedOption.status} label={pillLabel(selectedOption.status)} />
        )}
      </div>

      {open && (
        <ul id={listboxId} role="listbox" aria-labelledby={id} className={own.listbox}>
          {options.map((option, index) => (
            <li
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={option.value === selectedValue}
              className={`${own.option}${index === activeIndex ? ` ${own.active}` : ''}`}
              onClick={() => commit(index)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className={own['option-label']}>{option.label}</span>
              {option.status && <Pill variant={option.status} label={pillLabel(option.status)} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
