"use client"

import { useState } from "react";
import styles from "./logs-tab.module.css";
import FilterListbox from "@/components/ui/filters/FilterListbox";
import LogViewer from "./LogViewer";
import SearchInput from "@/components/ui/filters/SearchInput";
import { JobLog, LogFilters } from "@/lib/data/run-detail";

interface LogsTabProps {
  logs: JobLog[];
  logFilters: LogFilters[];
}

export default function LogsTab({ logs, logFilters }: LogsTabProps) {
  const [selectedLogIndex, setSelectedLogIndex] = useState(logFilters[0]?.value);
  const [attempt, setAttempt] = useState<number | null>(null);

  const attemptsForStage = logs.filter(l => l.stageId === selectedLogIndex).map(l => l.attempt);
  const highestAttempt = attemptsForStage.length ? Math.max(...attemptsForStage) : 0;

  if (attempt === null && attemptsForStage.length) setAttempt(highestAttempt);
  
  if (selectedLogIndex === undefined && logFilters.length) setSelectedLogIndex(logFilters[0].value);

  const selectedLog = logs.find(l => l.stageId === selectedLogIndex && l.attempt === attempt);

  if (logFilters.length === 0) return null;

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
