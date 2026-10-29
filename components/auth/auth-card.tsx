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
        "auth-stage relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-8",
        isShemesh && "shemesh-os",
      )}
    >
      <AuthAtmosphere tone={isShemesh ? "shemesh" : "liba"} />

      <div className="relative z-10 w-full max-w-[440px]">
        {brand === "chooser" ? (
          <p className="auth-kicker mb-4 text-center">ליבה · שמש</p>
        ) : (
        <div className="auth-brand mb-6 flex justify-center px-2">
          <div className="relative w-full max-w-[300px]">
            <p className="auth-kicker mb-1 text-center">{isShemesh ? "שמש" : "ליבה"}</p>
            <p className="auth-tagline mb-3 text-center text-xs font-medium text-muted-foreground">
              {isShemesh ? "מימוש זכויות" : "ביטוח ופיננסים"}
            </p>
            {isShemesh ? (
              <span className="logo-plate relative z-10 mx-auto flex justify-center rounded-lg px-4 py-2">
                <Image
                  src="/brand/shemesh-logo.png"
                  alt="שמש מימוש זכויות"
                  width={605}
                  height={782}
                  priority
                  className="h-auto max-h-32 w-auto object-contain"
                />
              </span>
            ) : (
              <LogoBadge full href="/login" className="relative z-10" />
            )}
          </div>
        </div>
        )}

        <div
          data-auth-obstacle
          className="auth-panel relative overflow-hidden rounded-[20px] border border-black/[0.06] bg-white/80 p-6 shadow-card backdrop-blur-xl sm:p-10"
        >
          <div className="mb-6 text-center">
            <h1 className="text-[2rem] font-semibold leading-[1.15] tracking-tight text-foreground sm:text-4xl">
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

        <p className="auth-foot mt-6 text-center text-xs font-medium tracking-wide text-muted-foreground">
          {footer}
        </p>
      </div>
    </div>
  );
}
