"use client"

import { useRouter } from 'next/navigation';
import Pill from '@/components/Pill';
import type { Secret } from "@/lib/data/secrets";
import { capitalize } from '@/lib/utils/string';
import { formatDate } from '@/lib/utils/date';

export default function SecretRow({ secret }: { secret: Secret }) {
  const router = useRouter();

  const open = () => router.push(`/secrets?id=${secret.id}`);

  return (
    <tr style={{ cursor: 'pointer' }} onClick={open}>
      <td>
        {secret.key}
        {secret.notes && (<><br /><span>{secret.notes?.length > 40 ? secret.notes.slice(0, 40) + "..." : secret.notes}</span></>)}
      </td>
      <td>
        {secret.environment ? 
          <>
            {secret.environment.name} <Pill variant={secret.environment.type} label={capitalize(secret.environment.type)} />
          </> : "None" }
      </td>
      <td className="nowrap">{formatDate(secret.updatedAt)}</td>
    </tr>
  )
}