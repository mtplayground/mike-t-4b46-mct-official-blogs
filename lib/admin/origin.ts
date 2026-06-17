import { getSelfUrl } from "../env/server";

function getHeaderDerivedOrigin(request: Request) {
  const host = request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProtocol ?? new URL(request.url).protocol.replace(/:$/u, "");

  return host ? `${protocol}://${host}` : request.url;
}

export function getAdminRedirectOrigin(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new URL(getSelfUrl()).origin;
  }

  return getHeaderDerivedOrigin(request);
}
