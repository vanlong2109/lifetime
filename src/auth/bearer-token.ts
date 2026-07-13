// Extract the token from an `Authorization: Bearer <token>` header.
export function extractBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.byteLength !== bb.byteLength) return false;
  return crypto.subtle.timingSafeEqual(ba, bb);
}

// Fail-closed (findings M1/SA2): an unset/empty secret denies every request; a
// missing/blank bearer denies. Constant-time compare on the token.
export function isAuthorized(
  authHeader: string | null | undefined,
  secret: string | undefined | null,
): boolean {
  if (!secret || secret.trim() === "") return false;
  const token = extractBearer(authHeader);
  if (!token) return false;
  return timingSafeEqual(token, secret);
}
