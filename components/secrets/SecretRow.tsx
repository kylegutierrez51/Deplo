"use client"

import { useRouter } from 'next/navigation';
import Pill from '@/components/Pill';
import type { SecretListItem } from "@/lib/data/secrets";

export default function SecretRow({ secret }: { secret: SecretListItem }) {
  const router = useRouter();

  const open = () => router.push(`/secrets?id=${secret.id}`);

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td>
        {secret.secretKey}
        {secret.notes && (<><br /><span>{secret.notes.slice(0, 40)}...</span></>)}
      </td>
      <td><Pill variant={secret.environmentType} label={secret.environmentName} /></td>
      <td className="nowrap">{secret.updatedAt}</td>
    </tr>
  )
}