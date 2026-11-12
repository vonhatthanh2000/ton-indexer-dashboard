import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, cookieOptions, readSession } from "@/server/session";

function home(role: "admin" | "project"): string {
  return role === "admin" ? "/admin" : "/project";
}

function redirect(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url));
}

// Page guard (PLAN.md Decisions › Page guards); layouts only check the role.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const state = await readSession(request.cookies);
  const isWorkspace = pathname.startsWith("/admin") || pathname.startsWith("/project");
  const next = encodeURIComponent(`${pathname}${search}`);

  if (state.kind === "expired") {
    const target = isWorkspace ? `/login?reason=expired&next=${next}` : "/login?reason=expired";
    if (pathname === "/login" && request.nextUrl.searchParams.get("reason") === "expired") {
      const response = NextResponse.next();
      response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(request), maxAge: 0 });
      return response;
    }
    const response = redirect(request, target);
    response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(request), maxAge: 0 });
    return response;
  }

  if (state.kind === "none") {
    if (isWorkspace) return redirect(request, `/login?next=${next}`);
    if (pathname === "/") return redirect(request, "/login");
    return NextResponse.next();
  }

  if (pathname === "/" || pathname === "/login") return redirect(request, home(state.session.role));
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/project/:path*"],
};
