import { ShemeshConnectPanel } from "@/components/shemesh/connect-panel";
import { ShemeshPage } from "@/components/shemesh/widgets";
import { Cable } from "lucide-react";
import { loadShemeshLinks } from "@/lib/shemesh/connect";

export const dynamic = "force-dynamic";

export default async function ShemeshSourcesPage() {
  const data = await loadShemeshLinks();
  return (
    <ShemeshPage
      title="מקורות"
      description="כל חיבור של שמש נשמר בשורה משלו, בנפרד מליבה. מפתחות נשמרים מוצפנים ולא מוצגים שוב."
      icon={Cable}
    >
      <ShemeshConnectPanel links={data.links} googleChoices={data.googleChoices} missing={data.missing} />
    </ShemeshPage>
  );
}
