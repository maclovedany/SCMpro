import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
/** 세션 갱신 + 비로그인 리다이렉트 (Next 16 proxy 컨벤션) */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!user && path !== "/login") {
    const url = request.nextUrl.clone(); url.pathname = "/login"; url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (user && (path === "/login" || path === "/")) {
    const url = request.nextUrl.clone(); url.pathname = "/dashboard"; url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
