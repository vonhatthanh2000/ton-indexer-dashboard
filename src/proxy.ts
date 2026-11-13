import { NextResponse, type NextRequest } from "next/server";

// Page guard (PLAN.md Decisions › Who is signed in). It only checks that the API's session cookie
// is present; it can't verify it. The workspace layout asks the API (`getMe`) and redirects on 401.
// Imports nothing that imports `server-only`.

const SESSION_COOKIE = "__Host-session";
const CLEAR_SESSION = `${SESSION_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
// v1's own cookies: no longer read, cleared when a browser still carries them.
const LEGACY_COOKIES = ["tonobs_session", "tonobs_pkeys"];
// Read by src/app/(workspace)/layout.tsx.
const PATH_HEADER = "x-dashboard-path";

function redirect(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url));
}

function clearLegacy(request: NextRequest, response: NextResponse): NextResponse {
  for (const name of LEGACY_COOKIES) {
    if (request.cookies.has(name)) {
      response.headers.append("set-cookie", `${name}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    }
  }
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  // 1. The API sends a failed Google sign-in back to `/?login_error=<code>`.
  const loginError = pathname === "/" ? searchParams.get("login_error") : null;
  if (loginError !== null) return redirect(request, `/login?error=${encodeURIComponent(loginError)}`);

  if (pathname === "/login") {
    // 3. A message to show: let it through, and drop a cookie the layout found invalid, which
    //    would otherwise bounce between /login and the workspace.
    if (searchParams.has("reason") || searchParams.has("error")) {
      const response = NextResponse.next();
      if (hasSession) response.headers.append("set-cookie", CLEAR_SESSION);
      return clearLegacy(request, response);
    }
    // 4. Already signed in.
    if (hasSession) return redirect(request, "/");
    return clearLegacy(request, NextResponse.next());
  }

  // 2. A workspace page without the cookie.
  const path = `${pathname}${search}`;
  if (!hasSession) return redirect(request, `/login?next=${encodeURIComponent(path)}`);

  // 5. Layouts build `next` from this header.
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, path);
  return clearLegacy(request, NextResponse.next({ request: { headers } }));
}

export const config = {
  matcher: ["/", "/login", "/projects/:path*", "/admin/:path*", "/account"],
};
