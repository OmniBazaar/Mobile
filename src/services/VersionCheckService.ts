/**
 * VersionCheckService — Queries the validator REST API to determine whether
 * the mobile app is running the latest version and whether an update is
 * mandatory.
 *
 * Uses the REST endpoint (not on-chain) because mobile apps should minimise
 * direct blockchain RPC calls. The validator already exposes
 * GET /api/v1/updates/latest?component=mobile-app which mirrors the on-chain
 * UpdateRegistry state.
 *
 * @module services/VersionCheckService
 */

import Constants from 'expo-constants';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** Version comparison result */
export type VersionStatus =
  | 'up-to-date'
  | 'update-available'
  | 'mandatory-update'
  | 'unknown';

/** Response shape from GET /api/v1/updates/latest */
interface LatestReleaseResponse {
  version: string;
  minimumVersion: string;
  binaryHash: string;
  publishedAt: string;
  revoked: boolean;
}

/** Result returned by check() */
export interface VersionCheckResult {
  /** Running app version */
  currentVersion: string;
  /** Latest published version from validator */
  latestVersion: string;
  /** Minimum required version from validator */
  minimumVersion: string;
  /** Overall status classification */
  status: VersionStatus;
  /** ISO-8601 timestamp of last check */
  lastCheckedAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Semver helpers (inline — no runtime dependency)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Parse a semver string into [major, minor, patch].
 * Returns undefined if invalid.
 */
function parseSemver(v: string): [number, number, number] | undefined {
  const trimmed = v.replace(/^v/i, '');
  const parts = trimmed.split('.');
  if (parts.length < 2 || parts.length > 3) return undefined;
  const nums = parts.map(Number);
  if (nums.some(n => !Number.isFinite(n) || n < 0)) return undefined;
  return [nums[0], nums[1], nums[2] ?? 0];
}

/**
 * Compare two semver strings.
 * @returns negative if a < b, 0 if a === b, positive if a > b
 */
function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (pa === undefined || pb === undefined) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────────────────────

/** Default validator API base URL (overridden via constructor) */
const DEFAULT_VALIDATOR_URL = 'https://api.omnibazaar.com';

/** Component identifier in UpdateRegistry */
const COMPONENT_ID = 'mobile-app';

/**
 * Checks the validator REST API for mobile app version requirements.
 *
 * This is a lightweight service suitable for early-stage mobile development.
 * Wire it into App.tsx when the navigation stack is built:
 *
 * ```tsx
 * const versionCheck = new VersionCheckService();
 * const result = await versionCheck.check();
 * if (result.status === 'mandatory-update') {
 *   // Show non-dismissible update prompt
 * }
 * ```
 */
export class VersionCheckService {
  private readonly validatorUrl: string;
  private readonly timeoutMs: number;

  /**
   * @param validatorUrl - Base URL of a validator node (default: production)
   * @param timeoutMs - Request timeout in milliseconds (default: 10 000)
   */
  constructor(validatorUrl?: string, timeoutMs?: number) {
    this.validatorUrl = validatorUrl ?? DEFAULT_VALIDATOR_URL;
    this.timeoutMs = timeoutMs ?? 10_000;
  }

  /**
   * Query the validator for the latest mobile-app release and compare
   * against the running app version.
   */
  async check(): Promise<VersionCheckResult> {
    const currentVersion = this.getCurrentVersion();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const url = `${this.validatorUrl}/api/v1/updates/latest?component=${COMPONENT_ID}`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return this.buildResult('unknown', currentVersion, '', '');
      }

      const data = (await response.json()) as LatestReleaseResponse;
      const latestVersion = data.version ?? '';
      const minimumVersion = data.minimumVersion ?? '';

      const status = this.classify(currentVersion, latestVersion, minimumVersion);

      return this.buildResult(status, currentVersion, latestVersion, minimumVersion);
    } catch {
      return this.buildResult('unknown', currentVersion, '', '');
    }
  }

  /**
   * Read the current app version from Expo constants.
   */
  private getCurrentVersion(): string {
    return Constants.expoConfig?.version ?? '0.0.0';
  }

  /**
   * Classify the running version against server-provided data.
   */
  private classify(
    current: string,
    latest: string,
    minimum: string,
  ): VersionStatus {
    if (latest === '' && minimum === '') return 'unknown';

    if (minimum !== '' && compareSemver(current, minimum) < 0) {
      return 'mandatory-update';
    }

    if (latest !== '' && compareSemver(current, latest) >= 0) {
      return 'up-to-date';
    }

    if (latest !== '') return 'update-available';

    return 'unknown';
  }

  /**
   * Build a result object.
   */
  private buildResult(
    status: VersionStatus,
    currentVersion: string,
    latestVersion: string,
    minimumVersion: string,
  ): VersionCheckResult {
    return {
      currentVersion,
      latestVersion,
      minimumVersion,
      status,
      lastCheckedAt: new Date().toISOString(),
    };
  }
}
