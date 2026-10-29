import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f3ee",
};

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
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem("liba-theme")==="dark"){document.documentElement.classList.add("dark")}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
