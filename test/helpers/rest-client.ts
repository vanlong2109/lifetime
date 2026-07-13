import { SELF } from "cloudflare:test";

const BASE = "https://tieu-diem.test";
export const TEST_TOKEN = "test-secret-token";

// Fetch through the Worker entrypoint (exercises real dispatch + auth). Pass
// token=null to omit the Authorization header.
export function api(
  method: string,
  path: string,
  body?: unknown,
  token: string | null = TEST_TOKEN,
): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return SELF.fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function apiJson<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await api(method, path, body);
  return (await res.json()) as T;
}
