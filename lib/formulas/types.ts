export type FormulaCategoryId =
  | "leads"
  | "freelancer"
  | "partnership"
  | "salaried"
  | "wage-rules"
  | "pnl"
  | "insurance";

export type FormulaLink = {
  label: string;
  href: string;
};

export type FormulaTerm = {
  label: string;
  value: string;
};

export type FormulaExample = {
  given: string;
  result: string;
};

export type FormulaDoc = {
  id: string;
  category: FormulaCategoryId;
  title: string;
  summary: string;
  equation: string;
  terms?: FormulaTerm[];
  notes?: string[];
  example?: FormulaExample;
  usedIn?: FormulaLink[];
};

export type FormulaCategory = {
  id: FormulaCategoryId;
  label: string;
  description: string;
};
