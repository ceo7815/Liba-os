const DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export function WeeklyChart() {
  const today = new Date().getDay();

  return (
    <div className="app-surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">פעילות שבועית</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">כניסות למערכת · 7 הימים האחרונים</p>
        </div>
        <span className="rounded-md bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          השבוע
        </span>
      </div>

      <div className="mt-6 flex h-44 items-end gap-3 sm:gap-4">
        {DAYS.map((day, index) => {
          const isToday = index === today;
          return (
            <div key={day} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="relative flex h-36 w-full items-end justify-center gap-1">
                <span className="absolute inset-x-1 bottom-0 h-px bg-black/[0.08]" />
                {isToday && (
                  <>
                    <span className="w-[36%] rounded-t-md bg-[#d8d8d4]" style={{ height: "24%" }} />
                    <span className="w-[36%] rounded-t-md bg-highlight" style={{ height: "40%" }} />
                  </>
                )}
              </div>
              <span
                className={
                  isToday
                    ? "text-[11px] font-semibold text-foreground"
                    : "text-[11px] font-medium text-muted-foreground"
                }
              >
                {day}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-[#d8d8d4]" />
          מערכת
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-highlight" />
          כניסה
        </span>
      </div>
    </div>
  );
}
