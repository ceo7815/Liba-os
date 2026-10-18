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
              className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50 blur-2xl"
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
          className="rounded-[2rem] border-[3px] border-highlight bg-white/93 p-8 shadow-[0_40px_100px_-28px_rgba(17,17,17,0.35)] backdrop-blur-xl sm:p-10"
        >
          <div className="mb-7 text-center">
            <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight text-black sm:text-3xl">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-sm font-semibold leading-relaxed text-[#5c5c5c]">
                {description}
              </p>
            )}
          </div>
          {children}
        </div>

        <p className="mt-6 text-center text-xs font-extrabold tracking-wide text-[#5c5c5c]">
          {footer}
        </p>
      </div>
    </div>
  );
}
