import Image from "next/image";
import { AuthAtmosphere } from "@/components/auth/auth-atmosphere";
import { LogoBadge } from "@/components/brand/logo-badge";
import { cn } from "@/lib/utils";

export function AuthCard({
  title,
  description,
  footer = "© ליבה ביטוח ופנסיוני · מערכת פנימית",
  brand = "liba",
  children,
}: {
  title: string;
  description?: string;
  footer?: string;
  brand?: "liba" | "shemesh" | "chooser";
  children: React.ReactNode;
}) {
  const isShemesh = brand === "shemesh";

  return (
    <div
      className={cn(
        "relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:py-12",
        isShemesh && "shemesh-os",
      )}
    >
      <AuthAtmosphere tone={isShemesh ? "shemesh" : "liba"} />

      <div className="relative z-10 w-full max-w-[440px] animate-auth-rise">
        {brand === "chooser" ? null : (
        <div className="mb-7 flex justify-center px-2">
          <div className="relative w-full max-w-[300px]">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-card/50 blur-2xl"
            />
            {isShemesh ? (
              <Image
                src="/brand/shemesh-logo.png"
                alt="שמש מימוש זכויות"
                width={605}
                height={782}
                priority
                className="relative z-10 mx-auto h-auto max-h-36 w-auto object-contain"
              />
            ) : (
              <LogoBadge full href="/login" className="relative z-10" />
            )}
          </div>
        </div>
        )}

        <div
          data-auth-obstacle
          className="relative overflow-hidden rounded-lg border border-border bg-card/95 p-8 shadow-pop backdrop-blur-xl sm:p-10"
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-highlight" />
          <div className="mb-7 text-center">
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {children}
        </div>

        <p className="mt-6 text-center text-xs font-medium tracking-wide text-muted-foreground">
          {footer}
        </p>
      </div>
    </div>
  );
}
