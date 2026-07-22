import styles from "./pipeline-editor.module.css";
import PipelineEditorHeader from "@/components/pipeline-editor/PipelineEditorHeader";
import Sidebar from "@/components/sidebar/Sidebar";
import { PipelineEditorChrome, SidebarSlot } from "@/components/pipeline-editor/PipelineEditorChrome";
import { PipelineGraphProvider } from "@/components/pipeline-editor/PipelineGraphProvider";
import Editor from "@/components/pipeline-editor/Editor/Editor";

interface EditorProps {
  params: Promise<{ id: string }>;
}
export default async function PipelineEditor({ params }: EditorProps) {
  const { id } = await params;

  console.log(id);

  const pipeline = { name: "deploy-api" };

  return (
    <PipelineEditorChrome>
      <SidebarSlot>
        <Sidebar activeItem="pipelines" showToggle={false} />
      </SidebarSlot>

      <PipelineGraphProvider>
        <PipelineEditorHeader
          pipelineName={pipeline.name}
        />

        <main className={`page-content ${styles['editor-main']}`}>
          <Editor />
        </main>
      </PipelineGraphProvider>
    </PipelineEditorChrome>
  )
}