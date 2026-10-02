import Pill from '@/components/ui/Pill';
import { capitalize } from '@/lib/utils/string';
import type { RunEnvironment } from '@/lib/types';
import styles from './environment-label.module.css';

/*
 * A run's environment: its name, its type, and — once the environment has been deleted — a note
 * saying so. A deleted environment still shows the type it had, so a run against a deleted
 * production environment still reads as production.
 */
export default function EnvironmentLabel({ environment, nameClassName }: {
  environment: RunEnvironment;
  nameClassName?: string;
}) {
  const { name, type, deleted } = environment;

  return (
    <span className={styles.label}>
      <span className={[nameClassName, !deleted && styles.live].filter(Boolean).join(' ')}>{name}</span>
      {type && <Pill variant={type} label={capitalize(type)} />}
      {deleted && <span className={styles.deleted} title="This environment has since been deleted">deleted</span>}
    </span>
  );
}
