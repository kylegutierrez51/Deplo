import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LoginButton from "./LoginButton";
import styles from "./page.module.css";

export default async function Login() {
  const session = await auth();

  if (session) {
    redirect("/pipelines");
  }

  return (
  <main>
    <div className={styles['login-container']}>
      <div className={styles['login-flex']}>
        <div className={styles.title}>Deplo</div>
        <LoginButton />
      </div>
    </div>
  </main>
  );
}
