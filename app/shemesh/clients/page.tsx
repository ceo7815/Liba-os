import type { Metadata } from "next";
import { ShemeshHub } from "@/components/shemesh/hub";
import { loadHubNumbers } from "@/lib/shemesh/hub-counts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "לקוחות ותיקים · שמש" };

export default async function Page() {
  return <ShemeshHub groupId="clients" numbers={await loadHubNumbers()} />;
}
