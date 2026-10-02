import styles from "./pipeline-editor.module.css";
import PipelineEditorHeader from "@/components/pipeline-editor/PipelineEditorHeader";
import Sidebar from "@/components/layout/sidebar/Sidebar";
import { PipelineEditorChrome } from "@/components/pipeline-editor/PipelineEditorChrome";
import { PipelineGraphProvider } from "@/components/pipeline-editor/PipelineGraphProvider";
import Editor from "@/components/pipeline-editor/Editor/Editor";
import { getEnvironments } from "@/lib/data/environments";
import { getSecrets } from "@/lib/data/secrets";
import { getPipelineById, getPipelineDefinition } from "@/lib/data/pipelines";
import { notFound } from "next/navigation";
import { resolveInitialEnvironment } from "@/lib/pipeline/environment-param";

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

  // The URL's choice, then the pipeline's default, then none.
  const initialEnvironmentId = resolveInitialEnvironment(environment, pipeline.defaultEnvironmentId, environments.map(env => env.id));

  return (
    <PipelineEditorChrome>
      <Sidebar activeItem="pipelines" showToggle={false} />

      <PipelineGraphProvider pipelineId={id} initialNodes={nodes} initialEdges={edges} initialEnvironmentId={initialEnvironmentId} secrets={secrets}>
        <PipelineEditorHeader
          pipelineName={pipeline.name}
          environments={environments}
          defaultEnvironmentId={pipeline.defaultEnvironmentId}
        />

        <main className={`page-content ${styles['editor-main']}`}>
          <Editor />
        </main>
      </PipelineGraphProvider>
    </PipelineEditorChrome>
  )
}