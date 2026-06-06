import styles from './stage-node.module.css'

// add OnApprove and OnReject: () => void;
interface StageNodeProps {
  icon: string;
  name: string;
  statusIcon: string;
  notLast: boolean
  isApproval?: boolean
}
export default function StageNode({ icon, name, statusIcon, notLast, isApproval = false }: StageNodeProps) {
  return (
    <>
      <div className={`${styles.stage} ${isApproval ? `${styles.approval}` : ''}`}>
        <ion-icon name={icon}></ion-icon>
        <span>{name}</span>
        <ion-icon name={statusIcon}></ion-icon>
      </div>
      {notLast && <span>→</span>}
    </>
  )
}