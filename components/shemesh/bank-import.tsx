"use client";

import { useFormState } from "react-dom";
import { importShemeshBank } from "@/app/actions/shemesh-ops";
import { Panel } from "@/components/shemesh/widgets";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/format/numbers";

const idle = { error: null as string | null, matched: 0, open: 0 };

export function BankImport() {
  const [state, action] = useFormState(importShemeshBank, idle);
  return (
    <Panel title="העלאת דף">
      <form action={action} className="grid gap-3 sm:max-w-md">
        <input name="file" type="file" accept=".csv,.xlsx,.xls" required className="text-sm" />
        <Button type="submit" className="w-fit">התאמה ושמירה</Button>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        {state.matched || state.open ? <p className="text-sm">הותאמו {formatCount(state.matched)}. בלי התאמה {formatCount(state.open)}.</p> : null}
      </form>
    </Panel>
  );
}
