import styles from "@/app/runs/runs.module.css";
import Pill from '@/components/ui/Pill';
import type { RunStatus } from '@/lib/types';
import { capitalize } from '@/lib/utils/string';

interface RunLabelProps {
  pipelineName: string | null;
  runNumber: number;
  status?: RunStatus;
}

export default function RunLabel({ pipelineName, runNumber, status }: RunLabelProps) {
  return (
    <div className={styles['pipeline-detail']}>
      <div className={styles['status-name']}>
        {status && <Pill variant={status} label={capitalize(status)} />}
        {pipelineName}
      </div>
      <span>#{runNumber}</span>
    </div>
  );
}
