export const PUBLIC_GATEWAY_HEALTH_ORIGIN = "https://matrix.knowhere.fyi";

export function configuredGatewayHealthOrigin(): URL {
  const url = new URL(PUBLIC_GATEWAY_HEALTH_ORIGIN);
  if (url.protocol !== "https:" || url.origin !== PUBLIC_GATEWAY_HEALTH_ORIGIN || url.pathname !== "/") {
    throw new Error("Gateway health origin must be the canonical HTTPS Gateway origin.");
  }
  return url;
}
