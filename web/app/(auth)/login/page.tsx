import { LoginForm } from "./LoginForm";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-background p-8 shadow-sm">
        <h1 className="text-xl font-semibold">SCMpro 로그인</h1>
        <p className="mt-1 text-sm text-muted-foreground">복합기 수요예측 · 월간 발주 시스템</p>
        <LoginForm next={next ?? "/dashboard"} />
      </div>
    </main>
  );
}
