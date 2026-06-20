'use client'

import { useState } from 'react';
import styles from './approval-card.module.css';

/*
toggle function:
 - 1st line gets the top div wrapper of ApprovalCard
 - 2nd line gets the .stages div
 - 3rd line toggles the .stages div off/on
 - 4th line updates the useState to update the text to show either the up or down arrow and "Show Stages" or "Hide Stages"
*/

export default function HideStagesButton() {
  const [hidden, setHidden] = useState(false);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const card = e.currentTarget.closest('[data-approval-card]');
    const stages = card?.querySelector<HTMLElement>('[data-stages-row]');
    stages?.classList.toggle(styles['stages--hidden']);
    setHidden((prev) => !prev);
  }

  return (
    <button onClick={toggle}>
      <ion-icon name={hidden ? 'chevron-up-outline' : 'chevron-down-outline'}></ion-icon>
      <span>{hidden ? 'Show stages' : 'Hide stages'}</span>
    </button>
  )
}
