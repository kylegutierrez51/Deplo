import Link from "next/link";
import Sidebar from "@/components/sidebar/Sidebar";
import styles from "@/app/not-found.module.css";

export default function PipelineNotFound() {
  return (
    <>
      <Sidebar activeItem="pipelines" />
      <main className="page-content">
        <div className={styles['not-found']}>
          <ion-icon name="alert-circle-outline" className={styles.icon}></ion-icon>
          <h1>Pipeline not found</h1>
          <p>This pipeline doesn&apos;t exist or may have been deleted.</p>
          <Link href="/pipelines" className={styles.back}>
            Back to Pipelines
          </Link>
        </div>
      </main>
    </>
  );
}
