"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { Panel, Stat } from "@/components/shemesh/widgets";
import { field, ModulePage } from "@/components/shemesh/module-shell";
import { formatShemeshMoney } from "@/lib/shemesh/format";
import { settlementGap } from "@/lib/shemesh/calculators";

export function SettlementScreen() {
  const [collected, setCollected] = useState("");
  const [transferred, setTransferred] = useState("");
  const gap = settlementGap(Number(collected) || 0, Number(transferred) || 0);

  return (
    <ModulePage
      title="הכנסה והתחשבנות"
      description="נפרעים, מכירת ביטוח, וגביית פדיונות שנכנסת לליבה וצריכה לעבור לשמש."
      icon={Wallet}
      emptyTitle="אין תנועות התחשבנות במסד"
      emptyBody="shemesh_income_items ו־shemesh_settlements לא הורצו לייצור. הזינו נגבה בליבה מול מה שהועבר. אין סכום שמור בקוד."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="נפרעים" value="מדוח הביטוח" />
        <Stat label="מכירת ביטוח" value="מדוח הביטוח" />
        <Stat label="יתרה מול ליבה" value={collected || transferred ? formatShemeshMoney(gap) : "—"} hint="נגבה פחות הועבר" />
      </div>
      <Panel title="חודש">
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={field} inputMode="decimal" placeholder="נגבה בחשבון ליבה" value={collected} onChange={(event) => setCollected(event.target.value)} />
          <input className={field} inputMode="decimal" placeholder="הועבר לשמש" value={transferred} onChange={(event) => setTransferred(event.target.value)} />
        </div>
      </Panel>
    </ModulePage>
  );
}
