import Link from 'next/link';
import styles from './subheader.module.css';

export default function SubheaderLink({ href, icon, text }: { href: string, icon: string, text: string }) {
  return (
    <Link href={href} className={styles.secondary}>
      <ion-icon name={icon}></ion-icon>
      {text}
    </Link>
  )
}
