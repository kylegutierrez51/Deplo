/* Whenever we add client interactivity to tables, separate them into their own Table.tsx file. This is just one example. Use it by adding "<RunsTable/>" */
"use client"

import { useState } from 'react';
import DataTable from '@/components/DataTable';
import styles from './run-history.module.css';

interface Run {
  id: number;
  status: string;
  pipeline: string;
  repo: string;
  version: string;
  environment: string;
  trigger: string;
  duration: string;
  time: string;
}

const runs: Run[] = [
  { id: 1, status: 'queued',    pipeline: 'deploy-api',       repo: 'acbcd/api-server',  version: 'v12', environment: 'production',  trigger: 'webhook', duration: '-',      time: '6h ago'  },
  { id: 2, status: 'running',   pipeline: 'build-frontend',   repo: 'acbcd/web-client',  version: 'v8',  environment: 'staging',     trigger: 'manual',  duration: '6h 1m',  time: '6h ago'  },
  { id: 3, status: 'succeeded', pipeline: 'deploy-api',       repo: 'acbcd/api-server',  version: 'v14', environment: 'development', trigger: 'api',     duration: '8m 0s',  time: '11h ago' },
  { id: 4, status: 'failed',    pipeline: 'deploy-api',       repo: 'acbcd/api-server',  version: 'v14', environment: 'preview',     trigger: 'webhook', duration: '8m 0s',  time: '11h ago' },
  { id: 5, status: 'cancelled', pipeline: 'deploy-api',       repo: 'acbcd/api-server',  version: 'v14', environment: 'custom',      trigger: 'manual',  duration: '8m 0s',  time: '11h ago' },
];

export default function RunsTable() {
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);

  return (
    <>
      <DataTable columns={['Pipeline', 'Environment Type', 'Trigger', 'Duration', 'Time']}>
        {runs.map((run) => (
          <tr key={run.id} onClick={() => setSelectedRun(run)} style={{ cursor: 'pointer' }}>
            <td>
              <div className={`pill pill--${run.status}`}>{run.status.charAt(0).toUpperCase() + run.status.slice(1)}</div>
              {' '}{run.pipeline}<br />
              <span>{run.repo}</span> &bull; {run.version}
            </td>
            <td><div className={`pill pill--${run.environment}`}>{run.environment.charAt(0).toUpperCase() + run.environment.slice(1)}</div></td>
            <td><div className={`pill pill--${run.trigger}`}>{run.trigger.charAt(0).toUpperCase() + run.trigger.slice(1)}</div></td>
            <td className={styles.filter}>
              <ion-icon name="stopwatch-outline"></ion-icon>
              <div className="nowrap">{run.duration}</div>
            </td>
            <td className="nowrap">{run.time}</td>
          </tr>
        ))}
      </DataTable>

      {selectedRun && (
        <div className="modal-overlay" onClick={() => setSelectedRun(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <p>Run detail modal — coming soon</p>
          </div>
        </div>
      )}
    </>
  );
}
