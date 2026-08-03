import styles from "./pipeline-editor.module.css";
import PipelineEditorHeader from "@/components/pipeline-editor/PipelineEditorHeader";
import Sidebar from "@/components/layout/sidebar/Sidebar";
import { PipelineEditorChrome, SidebarSlot } from "@/components/pipeline-editor/PipelineEditorChrome";
import { PipelineGraphProvider } from "@/components/pipeline-editor/PipelineGraphProvider";
import Editor from "@/components/pipeline-editor/Editor/Editor";
import { getEnvironments } from "@/lib/data/environments";
import { getSecrets } from "@/lib/data/secrets";
import { getPipelineById, getPipelineDefinition } from "@/lib/data/pipelines";
import { notFound } from "next/navigation";

interface EditorProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}
export default async function PipelineEditor({ params, searchParams }: EditorProps) {
  const { id } = await params;
  const { environment } = await searchParams;

  const pipeline = await getPipelineById(id);

  if (!pipeline) notFound();


  const environments = await getEnvironments();
  const secrets = await getSecrets();
  const { nodes, edges } = await getPipelineDefinition(id);

  // An id left in the URL after its environment was deleted is dropped here, so the field renders empty rather than showing a name that resolves to nothing. If user enters an array (?environment=a&environment=b), returns null.
  const initialEnvironmentId = environments.some(env => env.id === environment)
    ? environment as string
    : null;

  return (
    <PipelineEditorChrome>
      <SidebarSlot>
        <Sidebar activeItem="pipelines" showToggle={false} />
      </SidebarSlot>

      <PipelineGraphProvider pipelineId={id} initialNodes={nodes} initialEdges={edges} initialEnvironmentId={initialEnvironmentId} secrets={secrets}>
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