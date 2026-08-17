export type PortalStatus = "ready" | "connecting" | "planned";

export type PortalDefinition = {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  href: string;
  status: PortalStatus;
};

/**
 * Insurance company portals — unified intake area.
 * Each portal gets `/portals/<slug>` as a dedicated workspace.
 * Data connectors will plug in here later.
 */
export const portals: PortalDefinition[] = [
  {
    slug: "migdal",
    name: "מגדל",
    shortName: "מגדל",
    description: "פורטל מגדל — נתונים ופוליסות",
    href: "/portals/migdal",
    status: "planned",
  },
  {
    slug: "phoenix",
    name: "פניקס",
    shortName: "פניקס",
    description: "פורטל הפניקס — נתונים ופוליסות",
    href: "/portals/phoenix",
    status: "planned",
  },
  {
    slug: "clal",
    name: "כלל",
    shortName: "כלל",
    description: "פורטל כלל — נתונים ופוליסות",
    href: "/portals/clal",
    status: "planned",
  },
  {
    slug: "ayalon",
    name: "איילון",
    shortName: "איילון",
    description: "פורטל איילון — נתונים ופוליסות",
    href: "/portals/ayalon",
    status: "planned",
  },
  {
    slug: "menora",
    name: "מנורה",
    shortName: "מנורה",
    description: "פורטל מנורה — נתונים ופוליסות",
    href: "/portals/menora",
    status: "planned",
  },
  {
    slug: "hachshara",
    name: "הכשרה",
    shortName: "הכשרה",
    description: "פורטל הכשרה — נתונים ופוליסות",
    href: "/portals/hachshara",
    status: "planned",
  },
  {
    slug: "harel",
    name: "הראל",
    shortName: "הראל",
    description: "פורטל הראל — נתונים ופוליסות",
    href: "/portals/harel",
    status: "planned",
  },
  {
    slug: "meitav",
    name: "מיטב",
    shortName: "מיטב",
    description: "פורטל מיטב — נתונים ופוליסות",
    href: "/portals/meitav",
    status: "planned",
  },
];

export function getPortalBySlug(slug: string) {
  return portals.find((portal) => portal.slug === slug);
}

export function getPortalStatusLabel(status: PortalStatus) {
  switch (status) {
    case "ready":
      return "מחובר";
    case "connecting":
      return "בחיבור";
    case "planned":
      return "בהכנה";
  }
}
