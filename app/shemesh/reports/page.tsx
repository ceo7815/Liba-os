import { ShemeshReports } from "@/components/shemesh/reports-screen";
import { loadShemeshBooks } from "@/lib/shemesh/story";

export const dynamic = "force-dynamic";

export default async function ShemeshReportsPage() {
  return <ShemeshReports books={await loadShemeshBooks()} />;
}
