"use client"

import styles from "./pipeline-editor.module.css"
import PipelineEditorHeader from "@/components/pipeline-editor/PipelineEditorHeader"
import Sidebar from "@/components/Sidebar"
import StageSidebar from "@/components/pipeline-editor/StageSidebar/StageSidebar"

import { useState } from "react"

export default function PipelineEditor() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stageSidebarOpen, setStageSidebarOpen] = useState(false);
  const toggle = () => setSidebarOpen(o => !o);

  return (
    <>
      <Sidebar activeItem="pipelines" showToggle={false} open={sidebarOpen} onToggle={toggle}></Sidebar>

      <PipelineEditorHeader
        pipelineName={"deploy-api"}
        stageCount={7}
        connectionCount={6}
        onSidebarToggle={toggle} />

      <main className={`page-content ${styles['editor-main']}`}>
        <button
          id="stageSidebarToggle"
          className={styles['toggle-stage-sidebar']}
          onClick={() => setStageSidebarOpen(o => !o)}
        >
          Open Stage Sidebar
        </button>
      </main>

      <StageSidebar
        open={stageSidebarOpen}
        onClose={() => setStageSidebarOpen(false)}
        onDelete={() => {}}
      />
    </>
  )
}