export type AgentStatus = "ready" | "connecting" | "planned";

export type AgentDataModule =
  | "activity"
  | "costs"
  | "history"
  | "summaries"
  | "recommendations";

export type AgentDefinition = {
  slug: string;
  name: string;
  description: string;
  href: string;
  status: AgentStatus;
  /**
   * External agent runtime (separate project).
   * Each agent lives on its own subdomain and pushes / exposes
   * results into Liba OS — this app only displays the data.
   * Example: https://call-control.agents.example.com
   */
  externalBaseUrl?: string;
  /** Data surfaces shown in Liba OS for this agent */
  modules: AgentDataModule[];
};

/**
 * Agent fleet registry.
 *
 * Architecture:
 * - Agents are built and run in a separate system (per-agent subdomain).
 * - Liba OS is the management portal: costs, activity, history,
 *   summaries and recommendations are displayed here.
 * - Adding an agent = register here + connect its data feed later.
 */
export const agents: AgentDefinition[] = [
  {
    // API / Liba OS slug (Hermes folder/profile may be call-qa — send call-control in API)
    slug: "call-control",
    name: "סוכן בקרת שיחות",
    description:
      "ניתוח ובקרת שיחות — סיכומים, המלצות ומדדי איכות. הסוכן רץ במערכת נפרדת; התוצרים מוצגים כאן.",
    href: "/agents/call-control",
    status: "ready",
    externalBaseUrl: "",
    modules: ["activity", "costs", "history", "summaries", "recommendations"],
  },
  {
    slug: "social-media",
    name: "סוכן רשתות חברתיות",
    description:
      "יומן תוכן חודשי לפייסבוק ואינסטגרם — תזמון, אישור, תור פרסום ותיבת תגובות. Liba OS הוא מקור האמת; הפרסום בפועל דרך ראנר חיצוני.",
    href: "/agents/social-media",
    status: "ready",
    externalBaseUrl: "",
    modules: ["activity", "costs", "history", "summaries", "recommendations"],
  },
];

export function getAgentBySlug(slug: string) {
  return agents.find((agent) => agent.slug === slug);
}

export function getAgentStatusLabel(status: AgentStatus) {
  switch (status) {
    case "ready":
      return "מחובר";
    case "connecting":
      return "בחיבור";
    case "planned":
      return "מתוכנן";
  }
}

export function getAgentModuleLabel(module: AgentDataModule) {
  switch (module) {
    case "activity":
      return "פעילות";
    case "costs":
      return "עלויות";
    case "history":
      return "היסטוריה";
    case "summaries":
      return "סיכומים";
    case "recommendations":
      return "המלצות";
  }
}

export function getAgentModuleDescription(module: AgentDataModule) {
  switch (module) {
    case "activity":
      return "שימושים, הרצות וסטטוס שוטף של הסוכן";
    case "costs":
      return "עלויות תפעול וצריכת משאבים";
    case "history":
      return "יומן פעולות והרצות קודמות";
    case "summaries":
      return "סיכומי פלט מהסוכן";
    case "recommendations":
      return "המלצות שנוצרו על ידי הסוכן";
  }
}
