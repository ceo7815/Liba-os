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
    <header className="sticky top-0 z-40 bg-transparent px-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-3">
      <div className="float-bar flex h-12 min-w-0 max-w-full items-center gap-1.5 px-2 sm:gap-3 sm:px-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 rounded-xl active:scale-95 lg:hidden"
              aria-label="תפריט ניווט"
            >
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="shemesh-os w-[min(20rem,92vw)] border-s border-white/70 bg-white/80 p-0 [&>button]:hidden"
          >
            <SheetTitle className="sr-only">תפריט ניווט</SheetTitle>
            <ShemeshSidebar className="!m-0 h-full w-full !rounded-none" />
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
          <span className="hidden min-[400px]:inline-flex"><LiveClock /></span>
          <div className="hidden h-6 w-px bg-border sm:block" />
          <div className="hidden items-center gap-2.5 sm:flex">
            <div
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f2f2f4] text-[10px] font-semibold text-foreground"
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
