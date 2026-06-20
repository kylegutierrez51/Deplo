"use client"

import { useState } from "react";
import styles from "./stage-sidebar.module.css";
import StageTypeGrid from "./StageTypeGrid";
import EnvVarsSection from "./EnvVarsSection";
import SecretsSection from "./SecretsSection";

const INITIAL_SECRETS = [
  { key: "DATABASE_URL", env: "production", checked: false },
  { key: "API_SECRET_KEY", env: "production", checked: false },
  { key: "REDIS_URL", env: "staging", checked: false },
  { key: "STRIPE_SECRET", env: "production", checked: false },
  { key: "JWT_SECRET", env: "staging", checked: false },
  { key: "S3_ACCESS_KEY", env: "development", checked: false },
];

export default function StageConfigForm() {
  const [stageType, setStageType] = useState<string | undefined>(undefined);
  const [envVars, setEnvVars] = useState([{ key: "", value: "" }, { key: "", value: "" }]);
  const [secrets, setSecrets] = useState(INITIAL_SECRETS);
  const [secretSearch, setSecretSearch] = useState("");

  const handleEnvAdd = () => setEnvVars(prev => [...prev, { key: '', value: '' }]);

  const handleEnvDelete = (index: number) => {
    setEnvVars(prev => prev.filter((v, i) => i !== index));
  };

  const handleEnvChange = (index: number, field: 'key' | 'value', value: string) => {
    setEnvVars(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  }; /* runs when you change key or value in an env variable via changing the input */

  const handleSecretToggle = (index: number) => {
    setSecrets(prev => prev.map((s, i) => i === index ? { ...s, checked: !s.checked } : s));
  }; /* runs whenever you toggle a secret. Checks what secrets are toggled. */

  return (
    <form id="post-form" method="POST" onSubmit={e => e.preventDefault()}>
      <div className={styles["stage-sidebar-nav"]}>
        <div className={styles["stage-name"]}>
          <label htmlFor="stage-name">STAGE NAME</label>
          <input id="stage-name" name="stage-name" placeholder="e.g. build" />
        </div>
        <div className={styles["stage-types"]}>
          <label>STAGE TYPE</label>
          <StageTypeGrid selected={stageType} onSelect={setStageType} />
        </div>
        <div className={styles.command}>
          <label htmlFor="command">COMMAND</label>
          <textarea id="command" name="command" placeholder="e.g. npm run build"></textarea>
        </div>
        <div className={styles["timeout-and-retries"]}>
          <div className={styles.timeout}>
            <div><ion-icon name="time-outline"></ion-icon><label htmlFor="timeout">TIMEOUT (S)</label></div>
            <input id="timeout" name="timeout" defaultValue="0" />
          </div>
          <div className={styles.retries}>
            <div><ion-icon name="refresh-outline"></ion-icon><label htmlFor="retries">RETRIES</label></div>
            <input id="retries" name="retries" defaultValue="0" />
          </div>
        </div>
        <EnvVarsSection vars={envVars} onAdd={handleEnvAdd} onChange={handleEnvChange} onDelete={handleEnvDelete} />
        <SecretsSection
          secrets={secrets}
          searchValue={secretSearch}
          onSearchChange={setSecretSearch}
          onToggle={handleSecretToggle}
        />
      </div>
    </form>
  );
}