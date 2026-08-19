import defaultStyles from './filter-select.module.css'


interface FilterSelectProps {
  id: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  styles?: Record<string, string>; // Approvals, Webhooks, Run Detail //
  responsive?: boolean; // Pipeline Editor //
  value?: string;
  onChange?: (value: string) => void;
}


export default function FilterSelect({ id, name, options, defaultValue, styles=defaultStyles, responsive=true, value, onChange }: FilterSelectProps) {
  return (
    <div className={`${styles['select-group']}${responsive ? ` ${styles.responsive}` : ''}`}>
      <select
        id={id} name={name}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      >
        {options.map((option, index) => (
          <option value={option.value} key={index}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}