"use client"

import { useState } from "react";
import styles from "./stage-sidebar.module.css";
import StageTypeGrid from "./StageTypeGrid";
import EnvVarsSection from "./EnvVarsSection";
import SecretsSection from "./SecretsSection";
import type { CustomNode, StageType } from "@/lib/types";
import { usePipelineGraph } from "../PipelineGraphProvider";

const RESERVED_LABELS = ['approval', 'deploy'] as const;

/* Reserved labels are stored capitalized ('Approval', 'Deploy'), so compare normalized. */
function matchReservedLabel(value: string | undefined): typeof RESERVED_LABELS[number] | null {
  const normalized = value?.trim().toLowerCase();
  return RESERVED_LABELS.find(word => word === normalized) ?? null;
}

export default function StageConfigForm({ node }: { node: CustomNode }) {
  const [name, setName] = useState<string>(node?.data?.name as string | undefined ?? '');
  const [type, setType] = useState<StageType>(node?.data?.type || 'custom')
  const [label, setLabel] = useState<string>(matchReservedLabel(node?.data?.label) ? '' : node?.data?.label ?? '');
  const [command, setCommand] = useState<string>(node?.data?.command as string | undefined ?? '');
  const [timeOptions, setTimeOptions] = useState<{ timeout: string, retries: string }>({ timeout: node.data?.timeout ? String(node.data?.timeout) : '', retries: node.data?.retries ? String(node.data?.retries) : '' });
  const [envVars, setEnvVars] = useState<Record<string, string>[]>(node.data?.env_vars || []);
  const [secretSearch, setSecretSearch] = useState("");
  const { updateNodeData, selectedEnvironmentId, secrets } = usePipelineGraph();

  const reservedLabelMatch = matchReservedLabel(label);

  const checkedIds = selectedEnvironmentId ? (node.data?.secrets?.[selectedEnvironmentId] ?? []) : [];
  const environmentSecrets = selectedEnvironmentId
    ? secrets.filter(s => s.environmentId === selectedEnvironmentId)
    : [];
  const secretRows = environmentSecrets.map(s => ({
    id: s.id, key: s.key, checked: checkedIds.includes(s.id)
  }));

  const handleTimeOptionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (/^[0-9]*$/.test(value)) {
      if (name === 'retries' && Number(value) > 10) {
        setTimeOptions(prev => ({ ...prev, retries: '10' }));
        updateNodeData(node.id, { retries: 10 });
      }
      else if (name === 'timeout' && Number(value) > 3600) {
        setTimeOptions(prev => ({ ...prev, timeout: '3600' }));
        updateNodeData(node.id, { timeout: 3600 });
      }
      else {
        setTimeOptions(prev => ({ ...prev, [name]: value }));
        updateNodeData(node.id, { [name]: Number(value) });
      }
    }
  }

  const handleEnvAdd = () => setEnvVars(prev => [...prev, { key: '', value: '' }]);

  const handleEnvDelete = (index: number) => {
    setEnvVars(prev => prev.filter((_v, i) => i !== index));
    updateNodeData(node.id, { env_vars: envVars });
  };

  const handleEnvChange = (index: number, field: 'key' | 'value', value: string) => {
    setEnvVars(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
    updateNodeData(node.id, { env_vars: envVars });
  }; /* runs when you change key or value in an env variable via changing the input */

  const handleSecretToggle = (secretId: string) => {
    if (!selectedEnvironmentId) return;
    const allSecrets = node.data?.secrets ?? {};
    const current = allSecrets[selectedEnvironmentId] ?? [];
    const next = current.includes(secretId) ? current.filter(id => id !== secretId) : [...current, secretId]; // uncheck or check secret
    updateNodeData(node.id, { secrets: { ...allSecrets, [selectedEnvironmentId]: next } });
  };

  return (
    <div className={styles['stage-sidebar-container']}>
      <div className={styles["stage-sidebar-nav"]}>
        <div className={styles["stage-name"]}>
          <label htmlFor="stage-name">STAGE NAME</label>
          <input
            id="stage-name"
            name="stage-name"
            placeholder="e.g. build"
            value={name}
            onChange={e => {
              setName(e.target.value);
              updateNodeData(node.id, { name: e.target.value });
            }} />
        </div>
        <div className={styles["stage-types"]}>
          <label>STAGE TYPE</label>
          <StageTypeGrid node={node} selectedType={type} setType={setType} label={label} />
        </div>
        {type !== 'approval' &&
          <>
            {type !== 'deploy' &&
              <div className={styles.label}>
                <label htmlFor="stage-label">LABEL</label>
                <input
                  id="stage-label"
                  name="stage-label"
                  placeholder="e.g. build, script"
                  value={label}
                  onChange={e => {
                    setLabel(e.target.value);
                    updateNodeData(node.id, { label: e.target.value });
                  }}
                  className={reservedLabelMatch ? styles['input-error'] : undefined}
                  aria-invalid={reservedLabelMatch ? true : undefined}
                />
                {reservedLabelMatch &&
                  <p className={styles['error-text']}>
                    &ldquo;{label.trim()}&rdquo; is reserved for the {reservedLabelMatch === 'approval' ? 'Approval' : 'Deploy'} stage type.
                  </p>
                }
              </div>
            }
            <div className={styles.command}>
              <label htmlFor="command">COMMAND</label>
              <textarea
                id="command"
                name="command"
                placeholder="e.g. npm run build"
                value={command}
                onChange={e => {
                  setCommand(e.target.value)
                  updateNodeData(node.id, { command: e.target.value });
                }}>
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
              secrets={secretRows}
              searchValue={secretSearch}
              onSearchChange={setSecretSearch}
              onToggle={handleSecretToggle}
              hasEnvironment={Boolean(selectedEnvironmentId)}
            />
          </>
        }
      </div>
    </div>
  );
}