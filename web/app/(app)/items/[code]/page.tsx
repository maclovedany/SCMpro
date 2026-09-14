import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchItemDetail } from "@/lib/queries/items";
import { fetchItemForecast, fetchItemBacktest, fetchItemOl } from "@/lib/queries/forecast";
import { ItemDetail } from "./ItemDetail";
export default async function ItemPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const sb = await createServerSupabase();
  const key = decodeURIComponent(code);
  const [d, f, bt, ol] = await Promise.all([fetchItemDetail(sb, key), fetchItemForecast(sb, key), fetchItemBacktest(sb, key), fetchItemOl(sb, key)]);
  if (!d.master) notFound();
  return <ItemDetail d={d} forecast={f.forecast} cls={f.cls} backtest={bt} ol={ol} />;
}
