import defaultStyles from './filter-select.module.css'


interface FilterSelectProps {
  id: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  styles?: Record<string, string>; // Approvals, Webhooks, Run Detail //
  responsive?: boolean // Pipeline Editor //
}


export default function FilterSelect({ id, name, options, defaultValue, styles=defaultStyles, responsive=true }: FilterSelectProps) {
  return (
    <div className={`${styles['select-group']}${responsive ? ` ${styles.responsive}` : ''}`}>
      <select id={id} name={name} defaultValue={defaultValue}>
        {options.map((option, index) => (
          <option value={option.value} key={index}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}