"use client"

import { useState } from "react";
import styles from "./stage-sidebar.module.css";
import StageTypeGrid from "./StageTypeGrid";
import EnvVarsSection from "./EnvVarsSection";
import SecretsSection from "./SecretsSection";
import type { Node } from "@xyflow/react";

const INITIAL_SECRETS = [
  { key: "DATABASE_URL", env: "production", checked: false },
  { key: "API_SECRET_KEY", env: "production", checked: false },
  { key: "REDIS_URL", env: "staging", checked: false },
  { key: "STRIPE_SECRET", env: "production", checked: false },
  { key: "JWT_SECRET", env: "staging", checked: false },
  { key: "S3_ACCESS_KEY", env: "development", checked: false },
];

export type StageType = 'custom' | 'deploy' | 'approval';

const RESERVED_LABELS = ['approval', 'deploy'] as const;

type CustomNodeProps = Omit<Node, 'data'> & {
  data: {
    name: string;
    label: string;
    command: string;
    timeout: number;
    retries: number;
  }
}

export default function StageConfigForm({ node }: { node: CustomNodeProps }) {
  const [name, setName] = useState<string>(node?.data?.name as string | undefined ?? '');
  const [stageType, setStageType] = useState<StageType>('custom');
  const [label, setLabel] = useState<string>(node?.data?.label as string | undefined ?? '');
  const [command, setCommand] = useState<string>(node?.data?.command as string | undefined ?? '');
  const [timeOptions, setTimeOptions] = useState<{ timeout: string, retries: string }>({ timeout: node.data?.timeout ? String(node.data?.timeout) : '', retries: node.data?.retries ? String(node.data?.retries) : '' });
  const [envVars, setEnvVars] = useState([{ key: "", value: "" }, { key: "", value: "" }]);
  const [secrets, setSecrets] = useState(INITIAL_SECRETS);
  const [secretSearch, setSecretSearch] = useState("");

  console.log(timeOptions.timeout);

  const handleTimeOptionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (/^[0-9]*$/.test(value)) {
      if (name === 'retries' && Number(value) > 10) {
        setTimeOptions(prev => ({ ...prev, retries: '10'}));
      }
      else if (name === 'timeout' && Number(value) > 3600) {
        setTimeOptions(prev => ({ ...prev, timeout: '3600'}));
      } 
      else {
        setTimeOptions(prev => ({ ...prev, [name]: value }));
      }
    }
  }

  const normalizedLabel = label.trim().toLowerCase();
  const reservedLabelMatch = RESERVED_LABELS.find(word => word === normalizedLabel) ?? null;

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
    <form id="post-form" method="POST" onSubmit={e => {
      e.preventDefault();
      if (reservedLabelMatch) return;
    }}>
      <div className={styles["stage-sidebar-nav"]}>
        <div className={styles["stage-name"]}>
          <label htmlFor="stage-name">STAGE NAME</label>
          <input 
            id="stage-name" 
            name="stage-name" 
            placeholder="e.g. build" 
            value={name} 
            onChange={e => setName(e.target.value)} />
        </div>
        <div className={styles["stage-types"]}>
          <label>STAGE TYPE</label>
          <StageTypeGrid selected={stageType} onSelect={setStageType} />
        </div>
        {stageType !== 'approval' &&
          <>
            <div className={styles.label}>
              <label htmlFor="stage-label">LABEL</label>
              <input
                id="stage-label"
                name="stage-label"
                placeholder="e.g. build, script"
                value={label}
                onChange={e => setLabel(e.target.value)}
                className={reservedLabelMatch ? styles['input-error'] : undefined}
                aria-invalid={reservedLabelMatch ? true : undefined}
              />
              {reservedLabelMatch &&
                <p className={styles['error-text']}>
                  &ldquo;{label.trim()}&rdquo; is reserved for the {reservedLabelMatch === 'approval' ? 'Approval' : 'Deploy'} stage type.
                </p>
              }
            </div>
            <div className={styles.command}>
              <label htmlFor="command">COMMAND</label>
              <textarea
                id="command"
                name="command"
                placeholder="e.g. npm run build"
                value={command}
                onChange={e => setCommand(e.target.value)}>
              </textarea>
            </div>
            <div className={styles["timeout-and-retries"]}>
              <div className={styles.timeout}>
                <div><ion-icon name="time-outline"></ion-icon><label htmlFor="timeout">TIMEOUT (S)</label></div>
                <input 
                  id="timeout"
                  name="timeout"
                  value={timeOptions.timeout}
                  placeholder="In seconds (S)"
                  onChange={e => handleTimeOptionsChange(e)} />
              </div>
              <div className={styles.retries}>
                <div><ion-icon name="refresh-outline"></ion-icon><label htmlFor="retries">RETRIES</label></div>
                <input 
                  id="retries" 
                  name="retries" 
                  value={timeOptions.retries} 
                  placeholder="e.g. 1, 2, ..., 10"
                  onChange={e => handleTimeOptionsChange(e)} />
              </div>
            </div>
            <EnvVarsSection vars={envVars} onAdd={handleEnvAdd} onChange={handleEnvChange} onDelete={handleEnvDelete} />
            <SecretsSection
              secrets={secrets}
              searchValue={secretSearch}
              onSearchChange={setSecretSearch}
              onToggle={handleSecretToggle}
            />
          </>
        }
      </div>
    </form>
  );
}