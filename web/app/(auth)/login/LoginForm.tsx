"use client";
import { useActionState } from "react";
import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1"><Label htmlFor="email">이메일</Label><Input id="email" name="email" type="email" required autoComplete="username" /></div>
      <div className="space-y-1"><Label htmlFor="password">비밀번호</Label><Input id="password" name="password" type="password" required autoComplete="current-password" /></div>
      {state?.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "로그인 중…" : "로그인"}</Button>
    </form>
  );
}
