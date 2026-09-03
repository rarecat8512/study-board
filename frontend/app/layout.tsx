import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "./auth/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Study Board",
  description: "Frontend to FullStack 학습 게시판"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
