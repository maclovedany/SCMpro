import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/getProfile";
import { canWriteMaster } from "@/lib/auth/roles";
import { fetchHolidays } from "@/lib/queries/admin";
import { HolidayTable } from "./HolidayTable";
export default async function HolidaysPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const p = await getProfile(); if (!p || !canWriteMaster(p.role)) redirect("/dashboard");
  const { year: y } = await searchParams; const year = Number(y) || new Date().getFullYear();
  const rows = await fetchHolidays(await createServerSupabase(), year);
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">공휴일</h1><p className="text-sm text-muted-foreground">발주일·입고예정일이 주말/공휴일이면 이전 영업일로 당깁니다 (R-SCH-04).</p></div>
      <div className="flex gap-2 text-sm">{[year - 1, year, year + 1].map(yy => <Link key={yy} href={`/admin/holidays?year=${yy}`} className={yy === year ? "font-semibold underline" : "text-muted-foreground"}>{yy}</Link>)}</div>
      <HolidayTable rows={rows} />
    </div>
  );
}
