import styles from './filter-select.module.css'


interface FilterSelectProps {
  id: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string
}


export default function FilterSelect({ id, name, options, defaultValue }: FilterSelectProps) {
  return (
    <div className={styles['select-group']}>
      <select id={id} name={name} defaultValue={defaultValue}>
        {options.map((option, index) => (
          <option value={option.value} key={index}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}