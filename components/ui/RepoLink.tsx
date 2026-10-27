"use client"

import styles from './repo-link.module.css';
import { repoLabel, repoWebUrl } from '@/lib/utils/git';

interface RepoLinkProps {
  repoUrl: string;
  short?: boolean;
}


/*
 * This is a client component just so that it can use stopPropagation (putting the directive matters because it's used in RunDetailCard, which is a server component)
 * 
 * If 'short' is true and there's an href, the label is just the repo name
 * If 'short' is false, the label is `<owner>/<repo_name>`
 */
export default function RepoLink({ repoUrl, short = false }: RepoLinkProps) {
  const href = repoWebUrl(repoUrl);
  const fullLabel = repoLabel(repoUrl);
  const label = short && href ? fullLabel.slice(fullLabel.lastIndexOf('/') + 1) : fullLabel;

  if (!href) return <span className={styles['repo-link']} title={repoUrl}>{label}</span>;

  return (
    <a
      className={styles['repo-link']}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={fullLabel}
      onClick={e => e.stopPropagation()}
    >
      {label}
    </a>
  );
}
