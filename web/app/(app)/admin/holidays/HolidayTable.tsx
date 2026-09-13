"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { upsertHoliday, deleteHoliday } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function HolidayTable({ rows }: { rows: { date: string; name: string; country: string }[] }) {
  const [date, setDate] = useState(""); const [name, setName] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <div className="flex gap-2"><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 w-44" aria-label="날짜" /><Input value={name} onChange={e => setName(e.target.value)} placeholder="이름" className="h-9 w-56" aria-label="이름" />
        <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await upsertHoliday(date, name); if (r.ok) { toast.success("저장됨"); setDate(""); setName(""); } else toast.error(r.error); })}>추가</Button></div>
      <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="py-2">날짜</th><th>이름</th><th>국가</th><th></th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.date} className="border-t"><td className="py-1.5">{r.date}</td><td>{r.name}</td><td>{r.country}</td>
          <td className="text-right"><Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => { const x = await deleteHoliday(r.date); if (x.ok) toast.success("삭제됨"); else toast.error(x.error); })}>삭제</Button></td></tr>)}
        {rows.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">없음</td></tr>}</tbody></table>
    </div>
  );
}
