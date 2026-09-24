"use client"

import { useRouter, useSearchParams } from 'next/navigation';
import { withParams } from '@/lib/utils/url';
import Pill from '@/components/ui/Pill';
import type { Secret } from "@/lib/data/secrets";
import { capitalize } from '@/lib/utils/string';
import { formatDate } from '@/lib/utils/date';

export default function SecretRow({ secret }: { secret: Secret }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const open = () => router.push(withParams('/secrets', searchParams, { id: secret.id, mode: null })); 

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