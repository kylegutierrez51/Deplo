import type { Metadata } from "next";
import Script from 'next/script';
import { Open_Sans, JetBrains_Mono } from "next/font/google";
import Providers from "./providers";
import ToastShell from "@/components/ui/toast/ToastShell";
import "./globals.css";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  display: 'swap',
});

const jetbrains_mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Deplo",
  description: "A self-hosted deployment automation platform where teams define multi-stage deploy pipelines visually, trigger them from GitHub events, and monitor job execution with real-time logs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${openSans.variable} ${jetbrains_mono.variable}`}>
      <body>
        <Providers>
          {children}
          <ToastShell />
        </Providers>
      </body>
      <Script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></Script>
      <Script noModule src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"></Script>
    </html>
  );
}
