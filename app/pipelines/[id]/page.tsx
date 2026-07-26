import styles from "./pipeline-editor.module.css";
import PipelineEditorHeader from "@/components/pipeline-editor/PipelineEditorHeader";
import Sidebar from "@/components/sidebar/Sidebar";
import { PipelineEditorChrome, SidebarSlot } from "@/components/pipeline-editor/PipelineEditorChrome";
import { PipelineGraphProvider } from "@/components/pipeline-editor/PipelineGraphProvider";
import Editor from "@/components/pipeline-editor/Editor/Editor";
import { getEnvironments } from "@/lib/data/environments";
import { getSecrets } from "@/lib/data/secrets";
import { getPipelineById } from "@/lib/data/pipelines";
import { getPipelineDefinition } from "@/lib/data/pipeline-definitions";
import { notFound } from "next/navigation";

interface EditorProps {
  params: Promise<{ id: string }>;
}
export default async function PipelineEditor({ params }: EditorProps) {
  const { id } = await params;

  const pipeline = await getPipelineById(id);

  if (!pipeline) notFound();


  const environments = await getEnvironments();
  const secrets = await getSecrets();
  const { nodes, edges } = await getPipelineDefinition(id);

  return (
    <PipelineEditorChrome>
      <SidebarSlot>
        <Sidebar activeItem="pipelines" showToggle={false} />
      </SidebarSlot>

      <PipelineGraphProvider pipelineId={id} initialNodes={nodes} initialEdges={edges} secrets={secrets}>
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