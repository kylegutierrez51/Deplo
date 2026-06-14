"use client"

import styles from './sidebar.module.css';
import { useState, useRef, useEffect } from 'react';
import { useSession } from "next-auth/react";
import Image from "next/image";
import { logout } from "@/lib/actions/auth";

export default function Profile() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileStyle, setProfileStyle] = useState<React.CSSProperties>({});
  const profileRef = useRef<HTMLButtonElement>(null);

  const positionProfileOptions = () => {
    const rect = profileRef.current?.getBoundingClientRect();
    if (!rect) return;
    setProfileStyle({
      bottom: window.innerHeight - rect.top + 10,
      left: rect.left,
      width: rect.width,
      maxHeight: rect.top - 10,
    });
  };

  const handleProfileClick = () => {
    positionProfileOptions();
    setProfileOpen(o => !o);
  };

  useEffect(() => {
    if (!profileOpen) return;
    window.addEventListener('resize', positionProfileOptions);
    return () => window.removeEventListener('resize', positionProfileOptions);
  }, [profileOpen]);

  const { data: session } = useSession();
  return (
    <>
      <button
        ref={profileRef}
        type="button"
        className={styles.profile}
        aria-haspopup="menu"
        aria-expanded={profileOpen}
        onClick={handleProfileClick}
      >
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
        <div className={styles['profile-details']}>
          <div className={styles.user}>
            <div className={styles.name}>{session?.user?.name}</div>
            <div className={styles.role}>ADMIN</div>
          </div>
          <ion-icon name="chevron-up-outline"></ion-icon>
        </div>
      </button>

      <div className={`${styles['profile-options']} ${profileOpen ? ` ${styles.visible}` : ''}`} style={profileStyle}>
        <div className={styles['profile-menu']}>
          <div className={styles['profile-view']}>Profile</div>
          <div className={styles['sign-out']} onClick={() => logout()}>Sign Out</div>
        </div>
      </div>
    </>
  )
}
