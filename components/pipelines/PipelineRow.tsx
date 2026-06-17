"use client"

import { useRouter } from 'next/navigation';
import Pill from '@/components/Pill';
import type { Pipeline } from "@/lib/data/pipelines";

export default function EnvironmentRow({ pipeline }: { pipeline: Pipeline }) {
  const router = useRouter();
  const open = () => router.push(`/pipelines?id=${pipeline.id}`);

  const repoName = pipeline.repoUrl.slice(pipeline.repoUrl.lastIndexOf('/') + 1);

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td>{pipeline.name} <br /><span className="nowrap">79 runs (PipelineRun model)</span></td>
      <td><Pill variant={pipeline.status} label={pipeline.status.charAt(0).toUpperCase() + pipeline.status.slice(1)} /></td>
      <td>{repoName}<br /><span>{pipeline.commitMessage}</span></td>
      <td className="nowrap">{pipeline.lastRun || 'No Runs'}</td>
    </tr>
  )
}







