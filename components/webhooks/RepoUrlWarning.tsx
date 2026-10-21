import styles from './repo-url-warning.module.css';

export default function RepoUrlWarning({ message }: { message: string }) {
  return (
    <p className={styles.warning} role="note">
      <ion-icon name="warning-outline"></ion-icon>
      <span>{message}</span>
    </p>
  );
}
