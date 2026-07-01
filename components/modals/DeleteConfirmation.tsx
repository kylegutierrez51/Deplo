"use client"

import styles from './delete-confirmation.module.css';
import { useTransition, useState, useEffect } from 'react';
import { deleteEnvironment } from "@/lib/actions/environments";

interface DeleteConfirmationProps {
  id: string;
  onDelete: () => void;
  onDeleteClose: () => void;
}
export default function DeleteConfirmation({ id, onDelete, onDeleteClose }: DeleteConfirmationProps) {
  const [_isDeleteTransitionPending, startDeleteTransition] = useTransition();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setReady(true)
    }, 3000)

    return () => clearTimeout(timer);
  }, [])

  const handleDelete = () => startDeleteTransition(async () => {
    await deleteEnvironment(id);
    onDelete();
  });

  return (
    <div className={styles["delete-overlay"]} style={{ backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }} onClick={onDeleteClose}>
      <div className={styles["delete-container"]} onClick={e => e.stopPropagation()}>
        <p>Delete this Environment?</p>
        <div className={styles['btn-group']}>
          <button className={styles["cancel-btn"]} type="button" onClick={onDeleteClose}>Cancel</button>
          {!ready ? 
            <button className={styles["delete-ghost-btn"]} type="button">Delete</button> :
            <button className={styles["delete-btn"]} type="button" onClick={handleDelete}>Delete</button> 
          }
        </div>
      </div>
    </div>
  )
}