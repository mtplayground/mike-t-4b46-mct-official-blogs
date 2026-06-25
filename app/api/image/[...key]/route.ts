import { type NextRequest, NextResponse } from "next/server";

import { getSignedPostImageUrl } from "@/lib/storage/object-storage";

// Always run on request so the presigned URL is freshly generated. This is the
// whole point of the proxy: pages embed a stable `/api/image/<key>` URL (safe to
// statically prerender) and the short-lived presigned URL is produced here, per
// request, instead of being baked into static HTML where it would expire + 403.
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const relativeKey = key.map((segment) => decodeURIComponent(segment)).join("/");

  try {
    const signedUrl = await getSignedPostImageUrl(relativeKey);
    const response = NextResponse.redirect(signedUrl, 307);
    response.headers.set("Cache-Control", "public, max-age=600");
    return response;
  } catch {
    return new NextResponse("Image not found", { status: 404 });
  }
}
