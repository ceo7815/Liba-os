import Image from "next/image";
import { AmbientOrbs } from "@/components/admin/ambient-orbs";
import { LocaleSwitch } from "@/components/admin/locale-switch";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="dark relative grid min-h-svh items-center justify-items-center overflow-hidden bg-black px-5 py-20 lg:px-8 lg:[justify-items:left]">
      <Image
        src="/imbody/centerpiece.webp"
        alt=""
        fill
        priority
        quality={90}
        sizes="100vw"
        className="object-cover object-center"
      />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgb(0_0_0/0.42)_100%)]" />
      <AmbientOrbs />
      <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-20 sm:right-6">
        <LocaleSwitch />
      </div>
      <section className="material relative z-10 flex w-full max-w-[26rem] flex-col lg:min-h-[min(38rem,calc(100svh-6rem))] lg:w-[32rem] lg:max-w-none">
        <div className="flex flex-1 flex-col justify-center gap-7">
          <Image src="/imbody/logo.webp" alt="IMBODY" width={108} height={24} priority className="mx-auto h-5 w-auto brightness-0 invert" />
          {children}
        </div>
      </section>
    </main>
  );
}
