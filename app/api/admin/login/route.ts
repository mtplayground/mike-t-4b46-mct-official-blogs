import { NextResponse } from "next/server";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSession,
  adminCredentialsMatch,
} from "@/lib/admin/session";
import { getAdminRedirectOrigin } from "@/lib/admin/origin";
import { getAdminCredentials } from "@/lib/env/server";

function safeAdminNext(value: FormDataEntryValue | null) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/admin") ||
    value.startsWith("/admin/login")
  ) {
    return "/admin";
  }

  return value;
}

function redirectToLogin(request: Request) {
  const url = new URL("/admin/login", getAdminRedirectOrigin(request));
  url.searchParams.set("error", "invalid");

  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");
  const nextPath = safeAdminNext(formData.get("next"));
  const credentials = getAdminCredentials();

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !adminCredentialsMatch({ username, password }, credentials)
  ) {
    return redirectToLogin(request);
  }

  const response = NextResponse.redirect(new URL(nextPath, getAdminRedirectOrigin(request)));
  const session = await createAdminSession(credentials.password);

  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: session,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
