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
  const [selectedLogIndex, setSelectedLogIndex] = useState(logs[0].stageId);

  const selectedLog = logs.find(l => l.stageId === selectedLogIndex);

  return (
    <>
      <div className={styles.filters}>
        <div className={styles['filters-bar']}>
          <FilterListbox
            id={"status"} name={"status"}
            styles={styles}
            options={logFilters}
            setFilteredOption={setSelectedLogIndex}
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
