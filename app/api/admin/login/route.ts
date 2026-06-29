import { NextResponse } from "next/server";

import { getAdminRedirectOrigin } from "@/lib/admin/origin";
import { getRustAdminApiUrl, redirectFromRustAuthResponse } from "@/lib/admin/rust-auth";

function formDataToUrlEncoded(formData: FormData) {
  const body = new URLSearchParams();

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      body.append(key, value);
    }
  }

  return body;
}

function redirectToLoginWithError(request: Request) {
  const url = new URL("/admin/login", getAdminRedirectOrigin(request));
  url.searchParams.set("error", "invalid");

  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  let rustResponse: Response;

  try {
    rustResponse = await fetch(getRustAdminApiUrl("/api/admin/login"), {
      method: "POST",
      body: formDataToUrlEncoded(await request.formData()),
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      redirect: "manual",
    });
  } catch (error) {
    console.error("Rust admin login failed:", error);

    return redirectToLoginWithError(request);
  }

  return redirectFromRustAuthResponse(request, rustResponse);
}
