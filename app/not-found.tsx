import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h1 className="text-2xl font-semibold">העמוד לא נמצא</h1>
      <p className="text-sm text-muted-foreground">ייתכן שהכתובת שגויה או שהסוכן עדיין לא הוגדר.</p>
      <Button asChild className="rounded-xl font-semibold">
        <Link href="/dashboard">חזרה ללוח הבקרה</Link>
      </Button>
    </div>
  );
}
