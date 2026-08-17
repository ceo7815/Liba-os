import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-rubik",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ליבה | ניהול פנימי",
    template: "%s | ליבה",
  },
  description: "פלטפורמת ניהול פנימית לסוכנות ליבה ביטוח ופנסיוני",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${rubik.variable} font-sans min-h-screen bg-background text-foreground`}>
        {children}
        <Toaster dir="rtl" theme="light" position="top-center" />
      </body>
    </html>
  );
}
