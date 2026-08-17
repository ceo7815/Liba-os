import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { HashSessionHandler } from "@/components/auth/hash-session-handler";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export const metadata: Metadata = {
  title: "הגדרת סיסמה",
};

export default function SetPasswordPage() {
  return (
    <AuthCard
      title="הגדרת סיסמה"
      description="בחרו סיסמה חדשה כדי להשלים את ההזמנה או האיפוס."
    >
      <HashSessionHandler />
      <SetPasswordForm />
    </AuthCard>
  );
}
