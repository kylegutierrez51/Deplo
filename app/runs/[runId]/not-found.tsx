import Link from "next/link";
import Sidebar from "@/components/layout/sidebar/Sidebar";
import styles from "@/app/not-found.module.css";

export default function RunNotFound() {
  return (
    <>
      <Sidebar activeItem="run-history" />
      <main className="page-content">
        <div className={styles['not-found']}>
          <ion-icon name="alert-circle-outline" className={styles.icon}></ion-icon>
          <h1>Run not found</h1>
          <p>This run doesn&apos;t exist or may have been deleted.</p>
          <Link href="/runs" className={styles.back}>
            Back to Run History
          </Link>
        </div>
      </main>
    </>
  );
}
