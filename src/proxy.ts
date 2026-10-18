import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/client", "/technicien", "/admin"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname + search);

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));
  // Public technician signup landing lives under /devenir-technicien; /technicien/* requires auth.
  if (isProtected && !request.cookies.get("kh_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|fonts/).*)"],
};
