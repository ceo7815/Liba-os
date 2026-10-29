import { saveTaxProfile, type TaxProfile } from "@/lib/finance/tax-profile";

export function TaxSettingsForm({ profile }: { profile: TaxProfile }) {
  return (
    <form action={saveTaxProfile} className="work-sheet grid gap-3 px-4 py-4">
      <div>
        <h2 className="text-sm font-semibold">פרטי העוסק לחשבונית המס</h2>
        <p className="mt-1 text-sm text-muted-foreground">השדות ריקים עד שתמלא אותם. המספר הוא 15 ספרות.</p>
      </div>
      <label className="grid gap-1 text-sm">
        שם משפטי
        <input name="legalName" defaultValue={profile.legalName} placeholder="IMBODY L.L.C" className="h-10 rounded-xl border border-border bg-transparent px-3" />
      </label>
      <label className="grid gap-1 text-sm">
        כתובת
        <input name="address" defaultValue={profile.address} placeholder="Unit, Dubai, United Arab Emirates" className="h-10 rounded-xl border border-border bg-transparent px-3" />
      </label>
      <label className="grid gap-1 text-sm">
        TRN
        <input name="trn" defaultValue={profile.trn} inputMode="numeric" placeholder="100000000000003" dir="ltr" className="h-10 rounded-xl border border-border bg-transparent px-3 text-start" />
      </label>
      <button type="submit" className="press h-10 w-fit rounded-full bg-primary px-4 text-sm text-primary-foreground">שמירה</button>
    </form>
  );
}
