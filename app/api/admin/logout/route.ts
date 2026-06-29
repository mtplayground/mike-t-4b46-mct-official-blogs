import { NextResponse } from "next/server";

import { getAdminRedirectOrigin } from "@/lib/admin/origin";
import { getRustAdminApiUrl, redirectFromRustAuthResponse } from "@/lib/admin/rust-auth";

function localLogoutFallback(request: Request) {
  const response = NextResponse.redirect(new URL("/admin/login", getAdminRedirectOrigin(request)));

  response.cookies.set({
    name: "mct_admin_session",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: 0,
  });

  return response;
}

export async function POST(request: Request) {
  let rustResponse: Response;

  try {
    rustResponse = await fetch(getRustAdminApiUrl("/api/admin/logout"), {
      method: "POST",
      redirect: "manual",
    });
  } catch (error) {
    console.error("Rust admin logout failed:", error);

    return localLogoutFallback(request);
  }

  return redirectFromRustAuthResponse(request, rustResponse);
}
