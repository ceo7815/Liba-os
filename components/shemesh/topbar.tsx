"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut, Menu } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { GlobalSyncButton } from "@/components/layout/global-sync-button";
import { LiveClock } from "@/components/layout/live-clock";
import { ShemeshSearch } from "@/components/shemesh/search";
import { ShemeshSidebar } from "@/components/shemesh/nav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Profile } from "@/lib/types";

export function ShemeshTopbar({ profile }: { profile: Profile }) {
  const displayName = profile.full_name || profile.email;
  const initials = getInitials(displayName);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/92 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center gap-1.5 px-3 pt-[env(safe-area-inset-top)] sm:gap-3 sm:px-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 rounded-xl active:scale-95 lg:hidden"
              aria-label="תפריט ניווט"
            >
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="h-[min(88dvh,44rem)] rounded-t-3xl border-t border-border bg-card p-0 [&>button]:hidden"
          >
            <SheetTitle className="sr-only">תפריט ניווט</SheetTitle>
            <ShemeshSidebar className="h-full w-full border-e-0" />
          </SheetContent>
        </Sheet>

        <Link href="/shemesh" className="min-w-0 lg:hidden">
          <Image
            src="/brand/shemesh-logo.png"
            alt="שמש"
            width={605}
            height={782}
            className="h-9 w-auto object-contain"
          />
        </Link>

        <div className="min-w-0 flex-1 sm:max-w-md">
          <ShemeshSearch />
        </div>

        <div className="ms-auto flex items-center gap-1 sm:gap-2.5">
          <GlobalSyncButton canSyncAds excelTarget="shemesh" />
          <LiveClock />
          <div className="hidden h-6 w-px bg-border sm:block" />
          <div className="hidden items-center gap-2.5 sm:flex">
            <div
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-highlight text-[10px] font-bold text-highlight-foreground"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight text-foreground">
                {displayName}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">שמש</p>
            </div>
          </div>
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="size-10 rounded-xl text-muted-foreground hover:text-foreground active:scale-95 sm:size-8 sm:rounded-lg"
              aria-label="יציאה"
            >
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ש";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}
