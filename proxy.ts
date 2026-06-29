import { NextRequest, NextResponse } from "next/server";

const ADMIN_LOGIN_PATH = "/admin/login";

function verifyUrl(request: NextRequest) {
  const base = process.env.RUST_API_BASE_URL || request.nextUrl.origin;
  return new URL("/api/admin/session", base).toString();
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!pathname.startsWith("/admin") || pathname === ADMIN_LOGIN_PATH) {
    return NextResponse.next();
  }

  try {
    const response = await fetch(verifyUrl(request), {
      headers: {
        cookie: request.headers.get("cookie") || "",
        accept: "application/json",
      },
      cache: "no-store",
    });
    const payload = (await response.json()) as { authenticated?: boolean };
    if (response.ok && payload.authenticated) {
      return NextResponse.next();
    }
  } catch (error) {
    console.error("Rust admin session verification failed:", error);
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = ADMIN_LOGIN_PATH;
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
