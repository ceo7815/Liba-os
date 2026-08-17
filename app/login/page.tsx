import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "התחברות",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <AuthCard
      title="התחברות למערכת"
      description="גישה מאובטחת לפלטפורמת הניהול הפנימית של ליבה"
    >
      <LoginForm disabledError={searchParams.error === "disabled"} />
    </AuthCard>
  );
}
