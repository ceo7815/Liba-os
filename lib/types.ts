export type UserRole = "admin" | "employee";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};
