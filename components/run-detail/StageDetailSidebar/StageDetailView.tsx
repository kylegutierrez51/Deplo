import styles from './stage-detail-sidebar.module.css';
import type { StageResultNode } from '@/lib/data/run-detail';
import type { StageType } from '@/lib/types';
import Link from 'next/link';

const STAGE_TYPES = [
  { type: 'custom', label: 'Custom', icon: 'flask-outline' },
  { type: 'deploy', label: 'Deploy', icon: 'rocket-outline' },
  { type: 'approval', label: 'Approval', icon: 'shield-checkmark-outline' },
] as const;

const EM_DASH = '—';

export default function StageDetailView({ node }: { node: StageResultNode }) {
  const { type, status, name, label, command, timeout, retries, env_vars, attempt, maxAttempts, secretKeys } = node.data;
  const stageType: StageType = type ?? 'custom';
  const envVars = env_vars ?? [];

  return (
    <div className={styles['stage-sidebar-container']}>
      <div className={styles['stage-sidebar-nav']}>

        <div className={styles['stage-name']}>
          <label id="stage-name-label">STAGE NAME</label>
          <p className={styles.value} aria-labelledby="stage-name-label">{name || EM_DASH}</p>
        </div>

        <div className={styles['stage-types']}>
          <label>STAGE TYPE</label>
          <div className={styles['stage-type-grid']}>
            {STAGE_TYPES.map(({ type: t, label: l, icon }) => (
              <div key={t}
                className={`${styles.item}${stageType === t ? ` ${styles['selected-type']}` : ''}`}
                aria-current={stageType === t || undefined}>
                <ion-icon name={icon}></ion-icon>
                <div>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {status === 'awaiting-approval' &&
        <div className={styles['approval-link-container']}>
          <Link href="/approvals" target="_blank" className={styles['approval-link']}>
            Go to Approval Page
          </Link>
        </div>

        }


        {stageType !== 'approval' &&
          <>
            {stageType !== 'deploy' &&
              <div className={styles.label}>
                <label id="stage-label-label">LABEL</label>
                <p className={styles.value} aria-labelledby="stage-label-label">{label || EM_DASH}</p>
              </div>
            }

            <div className={styles.command}>
              <label id="command-label">COMMAND</label>
              <pre className={`${styles.value} ${styles['command-value']}`} aria-labelledby="command-label">{command || EM_DASH}</pre>
            </div>

            <div className={styles['timeout-and-retries']}>
              <div className={styles.timeout}>
                <div><ion-icon name="time-outline"></ion-icon><label id="timeout-label">TIMEOUT (S)</label></div>
                <p className={styles.value} aria-labelledby="timeout-label">{timeout ?? EM_DASH}</p>
              </div>
              <div className={styles.retries}>
                <div><ion-icon name="refresh-outline"></ion-icon><label id="retries-label">RETRIES</label></div>
                <p className={styles.value} aria-labelledby="retries-label">{retries ?? EM_DASH}</p>
              </div>
            </div>

            <div className={styles['timeout-and-retries']}>
              <div className={styles.attempt}>
                <div><ion-icon name="repeat-outline"></ion-icon><label id="attempt-label">ATTEMPT</label></div>
                <p className={styles.value} aria-labelledby="attempt-label">{attempt} of {maxAttempts}</p>
              </div>
            </div>

            <div className={styles['env-vars']}>
              <div className={styles['env-title-container']}>
                <div className={styles['env-title']}>
                  <ion-icon name="settings-outline"></ion-icon>
                  <label>ENV VARIABLES</label>
                </div>
              </div>
              <div className={styles['env-vars-list']}>
                {envVars.length > 0
                  ? envVars.map((v, i) => (
                    <div key={i} className={styles['env-container']}>
                      <p className={styles.value}>{v.key}</p>
                      <span>=</span>
                      <p className={styles.value}>{v.value}</p>
                    </div>
                  ))
                  : <div className={styles.empty}>No environment variables.</div>
                }
              </div>
            </div>

            <div className={styles.secrets}>
              <div className={styles['secrets-info']}>
                <div>
                  <ion-icon name="lock-closed-outline"></ion-icon>
                  <label>SECRETS</label>
                </div>
                <div className={styles.info}>Injected at runtime. Never logged.</div>
              </div>
            </div>
            <div className={styles['secrets-list']}>
              {secretKeys.length > 0
                ? secretKeys.map((key) => (
                  <div key={key} className={styles['secret-container']}>
                    <div className={styles.secret}>
                      <span className={styles['secret-key']}>{key}</span>
                    </div>
                  </div>
                ))
                : <div className={styles.empty}>No secrets selected.</div>
              }
            </div>
          </>
        }

      </div>
    </div>
  );
}
