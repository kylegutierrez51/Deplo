"use client"

import { useTransition } from 'react'
import styles from './header-buttons.module.css'
import { usePipelineGraph } from './PipelineGraphProvider'
import { savePipelineDefinition } from '@/lib/actions/pipelines'
import { useToast } from '@/components/toast/ToastContext'

export default function HeaderButtons() {
  const { pipelineId, nodes, edges } = usePipelineGraph();
  const [isSaving, startSaveTransition] = useTransition();
  const { showToast } = useToast();

  const handleSave = () => startSaveTransition(async () => {
    const result = await savePipelineDefinition(pipelineId, nodes, edges);
    showToast(result.message, result.status === 'success' ? 'checkmark-circle-outline' : 'close-circle-outline');
  });

  return (
    <>
      <button className={styles['save-btn']} type="button" onClick={handleSave} disabled={isSaving}>
        <ion-icon name="save-outline"></ion-icon>
        {isSaving ? 'Saving...' : 'Save'}
      </button>
      <button className={styles['run-btn']}>
        <ion-icon name="caret-forward-outline"></ion-icon>
        Run Pipeline
      </button>
    </>

  )
}
