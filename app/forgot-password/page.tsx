import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "איפוס סיסמה",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="איפוס סיסמה"
      description="נשלח קישור לאימייל שלכם להגדרת סיסמה חדשה."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
