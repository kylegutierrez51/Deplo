import styles from './sidebar.module.css';
import { auth } from "@/auth";
import Image from "next/image";


export default async function Profile() {
  const session = await auth();
  return (
    <>
      {session?.user?.image ? (
        <Image
          src={session.user.image}
          width={48}
          height={48}
          alt={session.user.name ?? "Avatar"}
          style={{ borderRadius: "50%" }}
        />
      ) : 
      <div className={styles['profile-pic']}></div>
      }
      <div className={styles['profile-pic']}></div>
      <div className={styles['profile-details']}>
        <div className={styles.user}>
          <div className={styles.name}>{session?.user?.name}</div>
          <div className={styles.role}>ADMIN</div>
        </div>
        <ion-icon name="chevron-up-outline"></ion-icon>
      </div>
    </>
  )
}