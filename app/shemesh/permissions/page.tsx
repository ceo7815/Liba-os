import type { Metadata } from "next";
import Link from "next/link";
import { Shield } from "lucide-react";
import { ShemeshPage, Panel } from "@/components/shemesh/widgets";

export const metadata: Metadata = { title: "הרשאות · שמש" };

const KEYS = [
  { key: "shemesh.view", label: "צפייה", detail: "תיקים, כספים, ייצוא לאקסל וממשקים של שמש." },
  { key: "shemesh.manage", label: "ניהול", detail: "יצירה, שינוי סטטוס, שיוך מטפל, מסמכים ושמירת חיבורים." },
];

export default function Page() {
  return (
    <ShemeshPage title="הרשאות" description="שמש משתמשת בקטלוג ההרשאות הקיים. מנהל מערכת נכנס גם בלי המפתח." icon={Shield}>
      <div className="grid gap-3 sm:grid-cols-2">
        {KEYS.map((item) => (
          <Panel key={item.key} title={item.label}>
            <p className="font-mono text-xs">{item.key}</p>
            <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
          </Panel>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        סימון למשתמש נעשה במסך המשתמשים של ליבה.{" "}
        <Link href="/dashboard/users" className="font-medium text-foreground underline-offset-4 hover:underline">למשתמשים</Link>
      </p>
    </ShemeshPage>
  );
}
