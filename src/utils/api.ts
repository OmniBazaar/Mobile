/**
 * Minimal HTTP client placeholder.
 *
 * Older Mobile scaffolding referenced `@/utils/api` for REST calls. Mobile
 * now uses the shared Wallet clients directly (e.g. MarketplaceClient,
 * ClobService, ChallengeAuthClient from @wallet/services/*) which each
 * resolve their base URL via the ValidatorDiscoveryService.
 *
 * This module remains as a thin fallback for ad-hoc `fetch` wrappers in
 * the mobile UI layer. It will be removed once every `@/utils/api`
 * caller has been migrated to the appropriate client.
 */

/** Envelope shape returned by OmniBazaar validator REST endpoints. */
export interface ApiResponse<T = unknown> {
  /** Whether the server considered the request successful. */
  success: boolean;
  /** Optional payload when `success === true`. */
  data?: T;
  /** Optional human-readable error when `success === false`. */
  error?: string;
  /** Optional diagnostic message (e.g. rate-limit hints). */
  message?: string;
}

/** Error thrown by {@link api.fetch} when the response is non-2xx. */
export class ApiError extends Error {
  public readonly status: number;
  public readonly body: string;
  constructor(status: number, message: string, body: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Default fetch wrapper. Throws {@link ApiError} on non-2xx responses,
 * attempts to parse the body as JSON, and falls back to the raw text
 * on parse failure.
 *
 * @param input - URL or Request (passed straight to `fetch`).
 * @param init - RequestInit merged with a JSON content-type by default.
 * @returns Parsed response body.
 */
async function fetchJson<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new ApiError(response.status, response.statusText, text);
  }
  if (text.length === 0) return undefined as unknown as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

const api = { fetch: fetchJson };

export default api;
