import { getTranslations } from "next-intl/server";
import type { CardKind, CrmFile } from "@/lib/admin/crm-files";
import { removeCardFile, uploadCardFile } from "@/lib/crm/file-actions";

export async function CrmDocs({
  kind,
  id,
  files,
  canEdit,
}: {
  kind: CardKind;
  id: string;
  files: CrmFile[];
  canEdit: boolean;
}) {
  const t = await getTranslations("crm.docs");
  return (
    <section className="work-sheet grid gap-3 px-4 py-4">
      <h2 className="text-sm font-medium">{t("title")}</h2>
      {files.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
      <ul className="grid gap-2">
        {files.map((file) => (
          <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted px-3 py-2 text-sm">
            {file.href ? (
              <a href={file.href} className="min-w-0 break-all hover:underline" target="_blank" rel="noreferrer">
                {file.name}
              </a>
            ) : (
              <span className="min-w-0 break-all">{file.name}</span>
            )}
            {canEdit ? (
              <form action={removeCardFile}>
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="file" value={file.id} />
                <button type="submit" className="h-9 rounded-full px-3 text-sm text-muted-foreground hover:text-foreground">
                  {t("remove")}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form action={uploadCardFile} className="grid gap-2 border-t border-border pt-3">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t("upload")}</span>
            <input name="file" type="file" required className="text-sm" />
          </label>
          <p className="text-xs text-muted-foreground">{t("limit")}</p>
          <div>
            <button type="submit" className="press h-10 rounded-full bg-primary px-4 text-sm text-primary-foreground">
              {t("save")}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
