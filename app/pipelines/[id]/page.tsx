import styles from "./pipeline-editor.module.css";
import PipelineEditorHeader from "@/components/pipeline-editor/PipelineEditorHeader";
import Sidebar from "@/components/sidebar/Sidebar";
import StageSidebar from "@/components/pipeline-editor/StageSidebar/StageSidebar";
import { PipelineEditorChrome, SidebarSlot } from "@/components/pipeline-editor/PipelineEditorChrome";
import Editor from "@/components/pipeline-editor/Editor/Editor";

interface EditorProps {
  params: Promise<{ id: string }>;
}
export default async function PipelineEditor({ params }: EditorProps) {
  const { id } = await params;

  const pipeline = { name: "deploy-api" };
  const stageCount = 7;
  const connectionCount = 6;

  return (
    <PipelineEditorChrome>
      <SidebarSlot>
        <Sidebar activeItem="pipelines" showToggle={false} />
      </SidebarSlot>

      <PipelineEditorHeader
        pipelineName={pipeline.name}
        stageCount={stageCount}
        connectionCount={connectionCount}
      />

      <main className={`page-content ${styles['editor-main']}`}>
        <Editor />
      </main>
    </PipelineEditorChrome>
  )
}