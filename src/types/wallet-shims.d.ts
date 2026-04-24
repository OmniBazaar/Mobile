/**
 * Ambient declaration shims for Wallet-source transitive imports that
 * Mobile's tsc (under `module: commonjs`) can't type-resolve.
 *
 * Wallet's own Vite-based type-check uses modern module resolution that
 * picks up `@types/*` packages automatically; Mobile's RN / commonjs
 * setup is stricter. Rather than pollute Mobile's deps with every
 * @types/* used by Wallet, we shim the specific modules that surface
 * when Mobile imports from `@wallet/*`.
 *
 * Runtime resolution is unaffected — Metro bundles the actual modules
 * via Wallet's node_modules (sibling-resolved in metro.config.js).
 */

declare module 'create-hash' {
  /** Node-style hash object with chainable update + digest. */
  interface Hash {
    update(data: string | Buffer | Uint8Array, inputEncoding?: string): Hash;
    digest(): Buffer;
    digest(encoding: string): string;
  }
  /**
   * Factory — `createHash('sha256').update(...).digest()`.
   * Matches the signature published by `@types/create-hash`.
   *
   * @param algorithm - Hash algorithm (e.g., 'sha256').
   * @returns A Hash instance.
   */
  function createHash(algorithm: string): Hash;
  export default createHash;
  export = createHash;
}
