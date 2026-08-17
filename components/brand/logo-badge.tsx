import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoBadgeProps = {
  compact?: boolean;
  centered?: boolean;
  onDark?: boolean;
  full?: boolean;
  className?: string;
  href?: string;
};

export function LogoBadge({
  compact = false,
  centered = false,
  onDark = false,
  full = false,
  className,
  href = "/dashboard",
}: LogoBadgeProps) {
  if (full) {
    return (
      <Link
        href={href}
        className={cn(
          "group relative block w-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-highlight focus-visible:ring-offset-2",
          className,
        )}
      >
        <Image
          src="/logo-transparent.png"
          alt="ליבה"
          width={640}
          height={220}
          className="h-auto w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
          priority
        />
      </Link>
    );
  }

  if (onDark) {
    return (
      <Link
        href={href}
        className={cn(
          "group flex w-full items-center outline-none focus-visible:ring-2 focus-visible:ring-highlight focus-visible:ring-offset-2 focus-visible:ring-offset-[#141414]",
          className,
        )}
      >
        <span className="flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3">
          <Image
            src="/logo-transparent.png"
            alt="ליבה"
            width={220}
            height={72}
            className="h-11 w-auto max-w-[11.5rem] object-contain object-center"
            priority
          />
        </span>
      </Link>
    );
  }

  if (centered) {
    return (
      <Link
        href={href}
        className={cn(
          "group flex w-full flex-col items-center outline-none focus-visible:ring-2 focus-visible:ring-highlight focus-visible:ring-offset-2",
          className,
        )}
      >
        <div className="flex w-full items-center justify-center px-1 py-1">
          <Image
            src="/logo-transparent.png"
            alt="ליבה"
            width={320}
            height={120}
            className="h-16 w-auto max-w-[15rem] object-contain object-center"
            priority
          />
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-center rounded-2xl outline-none",
        className,
      )}
    >
      <Image
        src="/logo-transparent.png"
        alt="ליבה"
        width={compact ? 160 : 200}
        height={compact ? 56 : 64}
        className={cn(
          "object-contain object-center",
          compact ? "h-11 w-auto max-w-[9rem]" : "h-12 w-auto max-w-[11rem]",
        )}
        priority
      />
    </Link>
  );
}
