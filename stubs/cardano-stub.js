/**
 * Stub for `@emurgo/cardano-serialization-lib-nodejs` on React Native.
 *
 * Why this exists:
 *   The Cardano serialization library is a WebAssembly module. Hermes
 *   (RN 0.73's default JS engine) does NOT support WebAssembly, so
 *   neither the `-nodejs` variant (uses `fs.readFileSync` + Node Buffer
 *   to load the WASM blob — both unavailable in Hermes) nor the
 *   `-browser` variant (uses `import.meta.url + fetch()` — Hermes
 *   doesn't support `import.meta`) can ever run in this app.
 *
 *   The library is loaded transitively by
 *   `@wallet/core/keyring/cardanoCip1852` at module-eval time, which
 *   in turn is loaded by `familyAddressDerivation`. Without this
 *   alias, the bundle's top-level eval crashes during app boot the
 *   moment Cardano destructures `TextDecoder` / `TextEncoder` from
 *   the bundled `util` polyfill — the post-splash crash signature
 *   we shipped a fix attempt for and saw recur.
 *
 *   Mobile V1 does not expose any Cardano-specific UX, so the cost
 *   of stubbing is: nothing the user can reach. Anyone who calls a
 *   Cardano helper anyway gets an immediate, descriptive error
 *   instead of a cryptic Hermes crash.
 *
 *   When Cardano support lands on mobile (real wallet flow), swap
 *   this for a native module bridge or a WebView-hosted bridge that
 *   actually executes the WASM.
 *
 * @module stubs/cardano-stub
 */

const NOT_SUPPORTED = 'Cardano operations are not supported on the OmniBazaar mobile app yet.';

function notSupported() {
  throw new Error(NOT_SUPPORTED);
}

// Proxy lets every property access (function call, class instantiation,
// constant lookup) surface the same descriptive error. The `apply` and
// `construct` traps cover both `csl.foo()` and `new csl.Foo()` shapes
// that the Wallet's cardanoCip1852.ts uses.
const stubFn = new Proxy(notSupported, {
  apply: () => notSupported(),
  construct: () => notSupported(),
  get: (_target, prop) => {
    if (prop === 'then') return undefined; // not a thenable
    if (prop === Symbol.toPrimitive) return undefined;
    return stubFn;
  },
});

module.exports = new Proxy(
  {},
  {
    get: (_target, prop) => {
      if (prop === '__esModule') return true;
      if (prop === 'default') return stubFn;
      if (prop === 'then') return undefined;
      return stubFn;
    },
  },
);
