import { NextResponse } from "next/server";

import { getAdminRedirectOrigin } from "./origin";

export function getRustAdminApiUrl(path: "/api/admin/login" | "/api/admin/logout") {
  const rustApiBaseUrl = process.env.RUST_API_BASE_URL;

  if (!rustApiBaseUrl) {
    throw new Error("RUST_API_BASE_URL is required for Rust admin auth routes.");
  }

  return new URL(path, rustApiBaseUrl).toString();
}

export function copySetCookieHeader(source: Response, target: NextResponse) {
  const setCookie = source.headers.get("set-cookie");

  if (setCookie) {
    target.headers.append("set-cookie", setCookie);
  }
}

export function redirectFromRustAuthResponse(request: Request, response: Response) {
  const fallbackUrl = new URL("/admin/login", getAdminRedirectOrigin(request)).toString();
  const location = response.headers.get("location") ?? fallbackUrl;
  const status = response.status >= 300 && response.status < 400 ? response.status : 303;
  const redirect = NextResponse.redirect(location, { status });

  copySetCookieHeader(response, redirect);

  return redirect;
}
