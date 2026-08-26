"use client"

import { useTransition } from 'react'
import styles from './header-buttons.module.css'
import { usePipelineGraph } from './PipelineGraphProvider'
import { savePipelineDefinition, addPipelineRun } from '@/lib/actions/pipelines'
import { useToast } from '@/components/ui/toast/ToastContext'

export default function HeaderButtons() {
  const { pipelineId, selectedEnvironmentId, nodes, edges } = usePipelineGraph();
  const [isSaving, startSaveTransition] = useTransition();
  const [isRunning, startRunTransition] = useTransition();
  const { showToast, dismissStickyToasts } = useToast();

  const handleSave = () => startSaveTransition(async () => {
    const result = await savePipelineDefinition(pipelineId, nodes, edges);
    showToast({
      text: result.message, 
      icon: result.status === 'success' ? 'checkmark-circle-outline' : 'close-circle-outline'
    });
  });

  const handleRun = () => {
    // Clears the previous report so a retry replaces it rather than stacking on it.
    dismissStickyToasts();

    startRunTransition(async () => {
      const result = await addPipelineRun(pipelineId, selectedEnvironmentId, nodes, edges);
      const failed = result.status !== 'success';

      showToast({
        text: result.message,
        icon: failed ? 'close-circle-outline' : 'checkmark-circle-outline',
        link: result.runId ? `/runs/${result.runId}` : undefined,
        options: { sticky: true },
      });
    });
  }

  const isBusy = isSaving || isRunning;

  return (
    <>
      <button className={styles['save-btn']} type="button" onClick={handleSave} disabled={isBusy}>
        <ion-icon name="save-outline"></ion-icon>
        {isSaving ? 'Saving...' : 'Save'}
      </button>
      <button className={styles['run-btn']} type="button" disabled={isBusy} onClick={handleRun}>
        <ion-icon name="caret-forward-outline"></ion-icon>
        {isRunning ? 'Starting...' : 'Run Pipeline'}
      </button>
    </>

  )
}
