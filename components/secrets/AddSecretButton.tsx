"use client"

type ModalState = { mode: 'view'; row: number } | { mode: 'edit' } | { mode: 'create' } | null;

export default function AddSecretButton({ setModal }: { setModal: React.Dispatch<React.SetStateAction<ModalState>> }) {
  return (
    <button onClick={() => setModal({ mode: 'create' })}>
      <ion-icon name="add-outline"></ion-icon>
      Add Secret
    </button>
  )
}