"use client"

import { useState } from "react";
import styles from "./logs-tab.module.css";
import FilterListbox from "@/components/ui/filters/FilterListbox";
import LogViewer from "./LogViewer";
import SearchInput from "@/components/ui/filters/SearchInput";
import EmptyState from "@/components/ui/EmptyState";
import { JobLog, LogFilters } from "@/lib/data/run-detail";
import type { RunStatus } from "@/lib/types";

interface LogsTabProps {
  logs: JobLog[];
  logFilters: LogFilters[];
  runStatus: RunStatus;
}

const EMPTY_LOGS_COPY: Record<RunStatus, { heading: string; description: string }> = {
  queued: {
    heading: 'Waiting for the runner',
    description: 'Logs appear here as soon as the first stage starts.',
  },
  running: {
    heading: 'No logs yet',
    description: 'Logs appear here as soon as the first stage starts.',
  },
  cancelled: {
    heading: 'No logs for this run',
    description: 'It was cancelled before any stage started.',
  },
  failed: {
    heading: 'No logs for this run',
    description: 'None of its stages produced output.',
  },
  succeeded: {
    heading: 'No logs for this run',
    description: 'None of its stages produced output.',
  },
};

export default function LogsTab({ logs, logFilters, runStatus }: LogsTabProps) {
  const [selectedLogIndex, setSelectedLogIndex] = useState(logFilters[0]?.value);
  const [attempt, setAttempt] = useState<number | null>(null);

  const attemptsForStage = logs.filter(l => l.stageId === selectedLogIndex).map(l => l.attempt);
  const highestAttempt = attemptsForStage.length ? Math.max(...attemptsForStage) : 0;

  if (attempt === null && attemptsForStage.length) setAttempt(highestAttempt);
  
  if (selectedLogIndex === undefined && logFilters.length) setSelectedLogIndex(logFilters[0].value);

  const selectedLog = logs.find(l => l.stageId === selectedLogIndex && l.attempt === attempt);

  if (logFilters.length === 0) {
    const { heading, description } = EMPTY_LOGS_COPY[runStatus];
    return <EmptyState fill icon="receipt-outline" heading={heading} description={description} />;
  }

  return (
    <>
      <div className={styles.filters}>
        <div className={styles['filters-bar']}>
          <FilterListbox
            id={"status"} name={"status"}
            styles={styles}
            options={logFilters}
            setFilteredOption={(val) => {
              setSelectedLogIndex(val);
              setAttempt(null);
            }}
          />
          <FilterListbox
            key={selectedLogIndex}
            id={"attempts"} name={"attempts"}
            styles={styles}
            defaultValue={attempt ? String(attempt) : undefined}
            setFilteredOption={(val) => setAttempt(Number(val))}
            options={
              attemptsForStage.map((n) => (
                { value: String(n), label: `Attempt ${n}` }
              ))
            }
          />
          <SearchInput
            placeholder={"Search logs..."}
            styles={styles} />
        </div>
      </div>

      {selectedLog &&
        <LogViewer
          log={selectedLog}
        />
      }
    </>
  )
}
