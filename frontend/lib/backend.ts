// Server-only: imported exclusively by Route Handlers under app/api/, never
// by client components. This keeps the FastAPI backend's address (and the
// fact that it exists at all) out of the browser bundle - the browser only
// ever talks to this Next.js origin, which then proxies server-to-server.
// That also means the backend needs no CORS configuration for this app.
const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";

interface BackendResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}

export async function callBackend(path: string, init?: RequestInit): Promise<BackendResult> {
  try {
    const response = await fetch(`${BACKEND_URL}${path}`, { ...init, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch {
    return {
      ok: false,
      status: 503,
      data: { detail: "Authentication service is unavailable" },
    };
  }
}
