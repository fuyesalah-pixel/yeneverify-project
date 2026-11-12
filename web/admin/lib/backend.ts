// Server-side access to the admin API.
//
// The browser never talks to the backend: pages and server actions call these
// helpers, which attach the access token from the httpOnly cookie. Access
// tokens live 15 minutes, so a 401 is answered by rotating the refresh token
// (only possible from a route handler or a server action) and retrying once.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiErrorMessage, BACKEND_API_URL, REFRESH_COOKIE, REFRESH_MAX_AGE_SECONDS, SESSION_COOKIE } from "./api";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

interface CallOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  token?: string | null;
}

const secureCookies = process.env.NODE_ENV === "production";

export async function apiCall<T>(path: string, options: CallOptions = {}): Promise<ApiResult<T>> {
  const token = options.token ?? cookies().get(SESSION_COOKIE)?.value ?? null;

  let response: Response;
  try {
    response = await fetch(`${BACKEND_API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        accept: "application/json",
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 502, message: "Cannot reach the admin API. Please try again." };
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: apiErrorMessage(payload, `The admin API returned ${response.status}.`),
    };
  }

  // The API wraps successful responses as { success, data, meta }.
  return { ok: true, data: (payload?.data ?? payload) as T };
}

/**
 * Rotate the refresh token and rewrite both cookies.
 * Must only be called where cookies are writable (route handler, server action).
 */
export async function refreshAdminSession(): Promise<boolean> {
  const store = cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return false;

  let payload: {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  } | null = null;

  try {
    const response = await fetch(`${BACKEND_API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!response.ok) return false;
    const body = await response.json().catch(() => null);
    payload = body?.data ?? body;
  } catch {
    return false;
  }

  if (!payload?.accessToken) return false;

  store.set(SESSION_COOKIE, payload.accessToken, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, payload.expiresIn ?? 900),
  });

  if (payload.refreshToken) {
    store.set(REFRESH_COOKIE, payload.refreshToken, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_MAX_AGE_SECONDS,
    });
  }

  return true;
}

/** Clear admin cookies (expired or rejected session). */
export function clearAdminSession(): void {
  const store = cookies();
  for (const name of [SESSION_COOKIE, REFRESH_COOKIE]) {
    store.set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
  }
}

/**
 * Read data for a page render.
 * A 401 cannot be repaired here (a render may not set cookies), so it bounces
 * through the refresh route handler and comes back; 403 means the account is
 * not an admin and returns to the sign-in screen.
 */
export async function loadPageData<T>(path: string, nextPath: string): Promise<ApiResult<T>> {
  const result = await apiCall<T>(path);
  if (!result.ok && result.status === 401) {
    redirect(`/api/admin/refresh?next=${encodeURIComponent(nextPath)}`);
  }
  if (!result.ok && result.status === 403) {
    redirect("/login?denied=1");
  }
  return result;
}

/**
 * Mutating call from a server action. Refreshes an expired access token once
 * and retries, so a long-idle tab can still complete an action.
 */
export async function mutate<T>(
  path: string,
  body: unknown,
  method: "POST" | "PATCH" = "POST",
): Promise<ApiResult<T>> {
  const first = await apiCall<T>(path, { method, body });
  if (first.ok || first.status !== 401) return first;

  const refreshed = await refreshAdminSession();
  if (!refreshed) {
    clearAdminSession();
    redirect("/login?expired=1");
  }

  return apiCall<T>(path, { method, body });
}

/** Only same-origin relative paths are accepted as post-action destinations. */
export function safeReturnPath(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  return path;
}

/** Append a flash message to a path. */
export function withMessage(path: string, key: "notice" | "error" | "done", message: string): string {
  const [base, query] = path.split("?");
  const params = new URLSearchParams(query ?? "");
  params.set(key, message);
  return `${base}?${params.toString()}`;
}
