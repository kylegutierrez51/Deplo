"use client"

import styles from './stage-sidebar.module.css'
import StageTypeGrid from './StageTypeGrid'
import EnvVarsSection from './EnvVarsSection'
import SecretsSection from './SecretsSection'
import { useState } from 'react'

interface StageSidebarProps {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
}

const INITIAL_SECRETS = [
  { key: 'DATABASE_URL', env: 'production', checked: false },
  { key: 'API_SECRET_KEY', env: 'production', checked: false },
  { key: 'REDIS_URL', env: 'staging', checked: false },
  { key: 'STRIPE_SECRET', env: 'production', checked: false },
  { key: 'JWT_SECRET', env: 'staging', checked: false },
  { key: 'S3_ACCESS_KEY', env: 'development', checked: false },
];

export default function StageSidebar({ open, onClose, onDelete }: StageSidebarProps) {
  const [stageType, setStageType] = useState<string | undefined>(undefined);
  const [envVars, setEnvVars] = useState([{ key: '', value: '' }, { key: '', value: '' }]);
  const [secrets, setSecrets] = useState(INITIAL_SECRETS);
  const [secretSearch, setSecretSearch] = useState('');

  const handleEnvAdd = () => setEnvVars(prev => [...prev, { key: '', value: '' }]);
  const handleEnvChange = (index: number, field: 'key' | 'value', value: string) => {
    setEnvVars(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };
  const handleSecretToggle = (index: number) => {
    setSecrets(prev => prev.map((s, i) => i === index ? { ...s, checked: !s.checked } : s));
  };

  return (
    <aside className={`${styles['stage-sidebar']}${open ? ` ${styles.open}` : ''}`}>
      <div className={styles['stage-sidebar-header']}>
        <div className={styles['stage-title']}>
          <div className={styles['icon-border']}>
            <ion-icon name="rocket-outline"></ion-icon>
          </div>
          <div className={styles.title}>Configure Stage</div>
        </div>
        <button className={styles['exit-btn']} type="button" onClick={onClose}>
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>

      <form id="post-form" method="POST" onSubmit={e => e.preventDefault()}>
        <div className={styles['stage-sidebar-nav']}>

          <div className={styles['stage-name']}>
            <label htmlFor="stage-name">STAGE NAME</label>
            <input id="stage-name" name="stage-name" placeholder="e.g. build" />
          </div>

          <div className={styles['stage-types']}>
            <label>STAGE TYPE</label>
            <StageTypeGrid selected={stageType} onSelect={setStageType} />
          </div>

          <div className={styles.command}>
            <label htmlFor="command">COMMAND</label>
            <textarea id="command" name="command" placeholder="e.g. npm run build"></textarea>
          </div>

          <div className={styles['timeout-and-retries']}>
            <div className={styles.timeout}>
              <div>
                <ion-icon name="time-outline"></ion-icon>
                <label htmlFor="timeout">TIMEOUT (S)</label>
              </div>
              <input id="timeout" name="timeout" defaultValue="0" />
            </div>
            <div className={styles.retries}>
              <div>
                <ion-icon name="refresh-outline"></ion-icon>
                <label htmlFor="retries">RETRIES</label>
              </div>
              <input id="retries" name="retries" defaultValue="0" />
            </div>
          </div>

          <EnvVarsSection vars={envVars} onAdd={handleEnvAdd} onChange={handleEnvChange} />

          <SecretsSection
            secrets={secrets}
            searchValue={secretSearch}
            onSearchChange={setSecretSearch}
            onToggle={handleSecretToggle}
          />

        </div>
      </form>

      <div className={styles['delete-stage']}>
        <button className={styles['delete-btn']} type="button" onClick={onDelete}>
          <ion-icon name="trash-outline"></ion-icon>
          Delete Stage
        </button>
      </div>
    </aside>
  )
}
