import styles from "./pipeline-editor.module.css";
import PipelineEditorHeader from "@/components/pipeline-editor/PipelineEditorHeader";
import Sidebar from "@/components/sidebar/Sidebar";
import { PipelineEditorChrome, SidebarSlot } from "@/components/pipeline-editor/PipelineEditorChrome";
import { PipelineGraphProvider } from "@/components/pipeline-editor/PipelineGraphProvider";
import Editor from "@/components/pipeline-editor/Editor/Editor";
import { getEnvironments } from "@/lib/data/environments";
import { getSecrets } from "@/lib/data/secrets";

interface EditorProps {
  params: Promise<{ id: string }>;
}
export default async function PipelineEditor({ params }: EditorProps) {
  const { id } = await params;

  console.log(id);

  const pipeline = { name: "deploy-api" };
  const environments = await getEnvironments();
  const secrets = await getSecrets();

  return (
    <PipelineEditorChrome>
      <SidebarSlot>
        <Sidebar activeItem="pipelines" showToggle={false} />
      </SidebarSlot>

      <PipelineGraphProvider secrets={secrets}>
        <PipelineEditorHeader
          pipelineName={pipeline.name}
          environments={environments}
        />

        <main className={`page-content ${styles['editor-main']}`}>
          <Editor />
        </main>
      </PipelineGraphProvider>
    </PipelineEditorChrome>
  )
}