"use client"

import { capitalize } from "@/lib/utils/string";
import { useRouter } from 'next/navigation';
import type { Pipeline } from "@/lib/data/pipelines";
import Pill from '@/components/Pill';


export default function EnvironmentRow({ pipeline }: { pipeline: Pipeline }) {
  const router = useRouter();
  const open = () => router.push(`/pipelines?id=${pipeline.id}`);

  const repoName = pipeline.repoUrl.slice(pipeline.repoUrl.lastIndexOf('/') + 1);

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td>{pipeline.name} <br /><span className="nowrap">79 runs (PipelineRun model)</span></td>
      <td><Pill variant={pipeline.status} label={capitalize(pipeline.status)} /></td>
      <td>{repoName}<br /><span>{pipeline.commitMessage}</span></td>
      <td className="nowrap">{pipeline.lastRun || 'No Runs'}</td>
    </tr>
  )
}







