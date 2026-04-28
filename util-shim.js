/**
 * Drop-in replacement for the `util` module that adds the
 * `TextDecoder` / `TextEncoder` named exports the bundled `util`
 * polyfill (0.12.5) is missing.
 *
 * Why this exists (mirrors Wallet/util-shim.js):
 *   The Cardano serialization library and several other chain SDKs
 *   compile to JS that does `const { TextDecoder, TextEncoder } =
 *   require('util')` and then `new TextDecoder(...)` AT MODULE LOAD
 *   TIME. The Node `util` module has exposed those classes since
 *   Node 11; the npm `util` polyfill that Metro reaches for in the
 *   React Native bundle has not been updated to re-export them.
 *   Without this shim, `TextDecoder` is destructured to `undefined`,
 *   `new undefined(...)` throws at top-level eval, and the JS
 *   bundle crashes during boot.
 *
 *   Hermes (RN's default engine on 0.73) ships TextDecoder /
 *   TextEncoder on globalThis; we re-export them from the `util`
 *   namespace so destructuring picks them up.
 *
 * @module util-shim
 */

const utilPolyfill = require('util/util.js');

const TextDecoderRef =
  typeof globalThis.TextDecoder !== 'undefined' ? globalThis.TextDecoder : undefined;
const TextEncoderRef =
  typeof globalThis.TextEncoder !== 'undefined' ? globalThis.TextEncoder : undefined;

// CommonJS shape so Metro's `require('util')` callers see the merged
// surface immediately (Cardano's destructure is a CommonJS require).
const merged = Object.assign({}, utilPolyfill, {
  TextDecoder: TextDecoderRef,
  TextEncoder: TextEncoderRef,
});

module.exports = merged;
module.exports.default = merged;
module.exports.TextDecoder = TextDecoderRef;
module.exports.TextEncoder = TextEncoderRef;
