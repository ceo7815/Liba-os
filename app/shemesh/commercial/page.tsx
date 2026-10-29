import type { Metadata } from "next";
import { ShemeshHub } from "@/components/shemesh/hub";
import { loadHubNumbers } from "@/lib/shemesh/hub-counts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "שיווק ומכירות · שמש" };

export default async function Page() {
  return <ShemeshHub groupId="commercial" numbers={await loadHubNumbers()} />;
}
