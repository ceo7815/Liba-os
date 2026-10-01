import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

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
      <body className="font-sans min-h-screen bg-background text-foreground">
        {children}
        <Toaster dir="rtl" theme="light" position="top-center" />
      </body>
    </html>
  );
}
