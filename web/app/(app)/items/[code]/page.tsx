import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchItemDetail } from "@/lib/queries/items";
import { ItemDetail } from "./ItemDetail";
export default async function ItemPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const sb = await createServerSupabase();
  const d = await fetchItemDetail(sb, decodeURIComponent(code));
  if (!d.master) notFound();
  return <ItemDetail d={d} />;
}
