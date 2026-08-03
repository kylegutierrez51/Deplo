import Link from "next/link";
import Sidebar from "@/components/layout/sidebar/Sidebar";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <>
      <Sidebar />
      <main className="page-content">
        <div className={styles['not-found']}>
          <ion-icon name="alert-circle-outline" className={styles.icon}></ion-icon>
          <h1>Page not found</h1>
          <p>The page you&apos;re looking for doesn&apos;t exist or may have been moved.</p>
          <Link href="/pipelines" className={styles.back}>
            Back to Pipelines
          </Link>
        </div>
      </main>
    </>
  );
}
