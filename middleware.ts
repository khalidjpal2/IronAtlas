import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  function redirectTo(to: string) {
    const url = request.nextUrl.clone();
    url.pathname = to;
    const r = NextResponse.redirect(url);
    // Carry over any cookies the Supabase client set during token refresh.
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  }

  const isProtected =
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    path.startsWith("/achievements");
  if (isProtected && !user) return redirectTo("/");
  if (path === "/" && user) return redirectTo("/dashboard");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/.*).*)"],
};
