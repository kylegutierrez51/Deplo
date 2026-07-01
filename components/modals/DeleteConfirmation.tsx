import styles from './delete-confirmation.module.css';
import { useTransition } from 'react';
import { deleteEnvironment } from "@/lib/actions/environments";

interface DeleteConfirmationProps {
  id: string;
  onDelete: () => void;
  onDeleteClose: () => void;
}
export default function DeleteConfirmation({ id, onDelete, onDeleteClose }: DeleteConfirmationProps) {
  const [_isDeleteTransitionPending, startDeleteTransition] = useTransition();

  const handleDelete = () => startDeleteTransition(async () => {
    await deleteEnvironment(id);
    onDelete();
  });

  return (
    <div className={styles["delete-overlay"]} style={{ backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }} onClick={onDeleteClose}>
      <div className={styles["delete-container"]}>
        <p>Delete this Environment?</p>
        <div>
          <button className={styles["cancel-btn"]} type="button" onClick={onDeleteClose}>Cancel</button>
          <button className={styles["delete-btn"]} type="button" onClick={handleDelete}>Delete</button>
        </div>
      </div>
    </div>
  )
}