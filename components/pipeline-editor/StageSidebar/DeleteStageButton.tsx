"use client"

interface StageSidebarProps {
  className: string;
}

export default function DeleteStageButton({ className }: StageSidebarProps) {

  return (
    <button className={className} type="button">
      <ion-icon name="trash-outline"></ion-icon>
      Delete Stage
    </button>
  )
}
