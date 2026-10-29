export function Board({ title, lede, children }: { title: string; lede?: string; children: React.ReactNode }) {
  return (
    <section className="work-sheet">
      <header className="px-5 py-5 sm:px-6">
        <h2 className="text-xl font-semibold tracking-[-0.03em]">{title}</h2>
        {lede ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{lede}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function BoardTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-t border-black/10 text-xs font-medium text-muted-foreground">
            {columns.map((column) => (
              <th key={column} scope="col" className="px-6 py-3 text-start">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("|")} className="border-t border-black/10">
              {row.map((cell, index) => (
                <td key={`${cell}-${index}`} className="max-w-md px-6 py-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
