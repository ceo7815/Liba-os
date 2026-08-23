import { LogOut, Menu } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { GlobalSearch } from "@/components/layout/global-search";
import { LiveClock } from "@/components/layout/live-clock";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { canAccessFinance } from "@/lib/finance/access";
import type { Profile } from "@/lib/types";

type TopbarProps = {
  profile: Profile;
};

export function Topbar({ profile }: TopbarProps) {
  const displayName = profile.full_name || profile.email;
  const roleLabel = profile.role === "admin" ? "מנהל" : "עובד";
  const isAdmin = profile.role === "admin";
  const showFinance = canAccessFinance(profile);
  const initials = getInitials(displayName);

  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.08] bg-white">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-lg lg:hidden"
              aria-label="תפריט ניווט"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-64 border-s border-black/[0.08] bg-white p-0 [&>button]:hidden"
          >
            <SheetTitle className="sr-only">תפריט ניווט</SheetTitle>
            <Sidebar profile={profile} className="h-full w-full border-e-0" />
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          <GlobalSearch isAdmin={isAdmin} canAccessFinance={showFinance} />
        </div>

        <div className="hidden h-6 w-px bg-black/[0.08] md:block" />

        <LiveClock />

        <div className="hidden h-6 w-px bg-black/[0.08] sm:block" />

        <div className="flex items-center gap-2.5">
          <div className="hidden items-center gap-2.5 sm:flex">
            <div
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-highlight text-[10px] font-bold text-black"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight text-foreground">
                {displayName}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{roleLabel}</p>
            </div>
          </div>

          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label="יציאה"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ל";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
