import panelStyles from '@/components/ui/stage-panel.module.css';
import detailStyles from './stage-detail-sidebar.module.css';
import type { StageResultNode } from '@/lib/data/run-detail';
import { splitDirectory } from '@/lib/pipeline/directory';
import Link from 'next/link';

const styles = { ...panelStyles, ...detailStyles };
const STAGE_TYPES = [
  { type: 'custom', label: 'Custom', icon: 'flask-outline' },
  { type: 'deploy', label: 'Deploy', icon: 'rocket-outline' },
  { type: 'approval', label: 'Approval', icon: 'shield-checkmark-outline' },
] as const;
const EM_DASH = '—';

export default function StageDetailView({ node, envPresent }: { node: StageResultNode, envPresent: boolean }) {
  const { type, status, name, label, command, timeout, retries, env_vars, attempt, maxAttempts, secretKeys } = node.data;
  const stageType = type ?? 'custom';
  const envVars = env_vars ?? [];
  const { directory, body } = splitDirectory(command ?? '');

  return (
    <div className={`${styles['stage-sidebar-container']}`}>
      <div className={styles['stage-sidebar-nav']}>
        <section className={styles.section} aria-label="Stage details">
          <div className={styles['stage-name']}>
            <label id="stage-name-label">Stage name</label>
            <p className={styles.value} aria-labelledby="stage-name-label">{name || EM_DASH}</p>
          </div>
          <div className={styles['stage-types']}>
            <span id="stage-type-label" className={styles['field-label']}>Stage type</span>
            <div className={styles['stage-type-grid']} role="group" aria-labelledby="stage-type-label">
              {STAGE_TYPES.map(({ type: t, label: l, icon }) => (
                <div key={t} className={[styles.item, styles['readonly-type'], stageType === t ? styles['selected-type'] : ''].join(' ')} aria-current={stageType === t || undefined}>
                  <ion-icon name={icon}></ion-icon>
                  <span>{l}</span>
                </div>
              ))}
            </div>
          </div>
          {stageType === 'custom' && <div className={styles.label}>
            <label id="stage-label-label">Label</label>
            <p className={styles.value} aria-labelledby="stage-label-label">{label || EM_DASH}</p>
          </div>}
          {status === 'awaiting-approval' &&
            <div className={styles['approval-link-container']}>
              <Link href="/approvals" target="_blank" className={styles['approval-link']}>
                Go to Approval Page
              </Link>
            </div>}
        </section>

        {stageType !== 'approval' && <>
          <section className={styles.section} aria-labelledby="execution-title">
            <h3 id="execution-title" className={styles['section-title']}><ion-icon name="terminal-outline"></ion-icon>Execution</h3>
            <div className={styles.command}>
              <label id="command-label">Command</label>
              <pre className={styles.value + ' ' + styles['command-value']} aria-labelledby="command-label" title={command}>{body || EM_DASH}</pre>
            </div>
            <div className={styles.directory}>
              <label id="directory-label">Directory</label>
              <p className={styles.value + ' ' + styles['directory-value']} aria-labelledby="directory-label">{directory || EM_DASH}</p>
            </div>
            <div className={styles['timeout-and-retries']}>
              <div className={styles.timeout}>
                <div><ion-icon name="time-outline"></ion-icon><label id="timeout-label">Timeout (s)</label></div>
                <p className={styles.value} aria-labelledby="timeout-label">{timeout ?? EM_DASH}</p>
              </div>
              <div className={styles.retries}>
                <div><ion-icon name="refresh-outline"></ion-icon><label id="retries-label">Retries</label></div>
                <p className={styles.value} aria-labelledby="retries-label">{retries ?? EM_DASH}</p>
              </div>
              <div className={styles.attempt}>
                <div><ion-icon name="repeat-outline"></ion-icon><label id="attempt-label">Attempt</label></div>
                <p className={styles.value} aria-labelledby="attempt-label">{attempt} of {maxAttempts}</p>
              </div>
            </div>
          </section>
          <section className={styles.section} aria-labelledby="env-vars-title">
            <div className={styles['env-title-container']}>
              <div className={styles['env-title']}><ion-icon name="settings-outline"></ion-icon><h3 id="env-vars-title" className={styles['section-title']}>Environment variables</h3></div>
            </div>
            <div className={styles['env-vars-list']}>
              {envVars.length ? envVars.map((v, i) => <div key={i} className={styles['env-container'] + ' ' + styles['readonly-variable']}>
                <p className={styles.value}>{v.key}</p><span>=</span><p className={styles.value}>{v.value}</p>
              </div>) : <div className={styles.empty}>No environment variables.</div>}
            </div>
          </section>
          <section className={styles.section} aria-labelledby="secrets-title">
            <div className={styles.secrets}>
              <div className={styles['secrets-info']}>
                <div><ion-icon name="lock-closed-outline"></ion-icon><h3 id="secrets-title" className={styles['section-title']}>Secrets</h3></div>
                <div className={styles.info}>Injected at runtime. Masked in logs.</div>
              </div>
            </div>
            <div className={styles['secrets-list']}>
              {secretKeys.length ? secretKeys.map(key => <div key={key} className={styles['secret-container'] + ' ' + styles['selected-secret']}>
                <div className={styles.secret}><span className={styles['secret-key']}>{key}</span></div>
              </div>) : <div className={styles.empty}>{envPresent ? 'No secrets selected.' : 'No secrets.'}</div>}
            </div>
          </section>
        </>}
      </div>
    </div>
  );
}
