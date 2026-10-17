'use client'

import { usePipelineGraph } from './PipelineGraphProvider';
import styles from './default-directory-input.module.css';


export default function DefaultDirectoryInput() {
  const { defaultDirectory, setDefaultDirectory } = usePipelineGraph();

  return (
    <div className={styles.wrapper}>
      <ion-icon name="folder-outline"></ion-icon>
      <input
        type="text"
        aria-label="Default directory"
        title="Stages without their own directory run here"
        placeholder="Default directory"
        autoComplete="off"
        spellCheck={false}
        className={styles.input}
        value={defaultDirectory}
        onChange={e => setDefaultDirectory(e.target.value.replaceAll('"', ''))}
      />
    </div>
  )
}
