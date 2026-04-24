/**
 * TrezorBridgeService — message protocol for the hosted Trezor Connect
 * WebView.
 *
 * Trezor doesn't publish a first-party React Native SDK. The supported
 * mobile integration is to embed `https://connect.trezor.io/9/` in a
 * WebView and exchange postMessage frames with it. This service holds
 * the small request/response state machine that sits around the
 * WebView; the actual WebView component lives in
 * `screens/TrezorWebViewScreen.tsx`.
 *
 * Supported operations (v1):
 *   - `ethereumGetAddress` — read the Ethereum address at a derivation path.
 *   - `ethereumSignMessage` — EIP-191 sign (for challenge-response login).
 *   - `ethereumSignTransaction` — EIP-1559 sign for a classic tx.
 *
 * The service never talks to the Trezor directly; every method returns
 * a `TrezorRequest` that the WebView screen forwards, and the screen
 * in turn resolves the pending promise when the response arrives.
 */

/** A request the WebView should dispatch to the hosted Connect page. */
export interface TrezorRequest {
  /** Method name in the Trezor Connect JSON-RPC-ish shape. */
  method:
    | "ethereumGetAddress"
    | "ethereumSignMessage"
    | "ethereumSignTransaction";
  /** Per-method params — forwarded verbatim. */
  params: Record<string, unknown>;
  /** Internal request id used to correlate response messages. */
  id: string;
}

/** A response coming back from the WebView. */
export interface TrezorResponse {
  /** Correlated request id. */
  id: string;
  /** True when the device returned a success payload. */
  success: boolean;
  /** Response payload (address / signature / serialized tx). */
  payload?: Record<string, unknown>;
  /** Error message when `success` is false. */
  error?: string;
}

type Pending = {
  resolve: (payload: Record<string, unknown>) => void;
  reject: (err: Error) => void;
};

/**
 * Stateful bridge singleton. The WebView screen holds a reference and
 * forwards inbound messages via `onMessage`.
 */
class TrezorBridge {
  /** Pending requests waiting on the WebView to respond. */
  private pending: Map<string, Pending> = new Map();

  /** Monotonically-increasing id source. */
  private nextId = 1;

  /**
   * Build + track a request, returning the envelope the caller should
   * hand to the WebView's `postMessage` + a promise that resolves with
   * the response payload.
   *
   * @param method - Trezor Connect method name.
   * @param params - Method-specific params.
   * @returns Request envelope + response promise.
   */
  call<TPayload extends Record<string, unknown>>(
    method: TrezorRequest["method"],
    params: Record<string, unknown>,
  ): { request: TrezorRequest; response: Promise<TPayload> } {
    const id = `trezor-${this.nextId++}-${Date.now()}`;
    const request: TrezorRequest = { method, params, id };
    const response = new Promise<TPayload>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (payload) => resolve(payload as TPayload),
        reject,
      });
    });
    return { request, response };
  }

  /**
   * Handle an inbound message from the WebView. Resolves the
   * corresponding pending request (if any). Unknown ids are dropped
   * silently — the Trezor Connect page also emits lifecycle events
   * (`TRANSPORT`, `IFRAME_LOADED`) that we ignore.
   *
   * @param response - Parsed response envelope.
   */
  onMessage(response: TrezorResponse): void {
    const pending = this.pending.get(response.id);
    if (pending === undefined) return;
    this.pending.delete(response.id);
    if (response.success && response.payload !== undefined) {
      pending.resolve(response.payload);
    } else {
      pending.reject(new Error(response.error ?? "Trezor request failed"));
    }
  }

  /**
   * Reject every pending request with a fixed error. Called when the
   * WebView unmounts so callers don't hang forever.
   *
   * @param reason - Human-readable reason surfaced as the error message.
   */
  cancelAll(reason: string): void {
    for (const pending of this.pending.values()) {
      pending.reject(new Error(reason));
    }
    this.pending.clear();
  }
}

let bridgeInstance: TrezorBridge | undefined;

/**
 * Return the shared bridge. Constructed on first call; the WebView
 * screen holds a ref to the same instance the services use.
 *
 * @returns Shared TrezorBridge.
 */
export function getTrezorBridge(): TrezorBridge {
  if (bridgeInstance === undefined) bridgeInstance = new TrezorBridge();
  return bridgeInstance;
}

/**
 * Convenience: read the Ethereum address at a BIP44 path. Forwards
 * `showOnTrezor: false` by default so we don't pop a confirmation
 * screen for a read-only address query.
 *
 * @param path - BIP44 derivation path (e.g. `"m/44'/60'/0'/0/0"`).
 * @returns Request envelope + response promise resolving to `{ address }`.
 */
export function readEthereumAddress(
  path: string,
): { request: TrezorRequest; response: Promise<{ address: string }> } {
  return getTrezorBridge().call<{ address: string }>("ethereumGetAddress", {
    path,
    showOnTrezor: false,
  });
}

/**
 * Convenience: sign an EIP-191 personal message on the Trezor.
 *
 * @param path - BIP44 derivation path.
 * @param messageHex - 0x-prefixed hex of the message bytes.
 * @returns Request envelope + response promise resolving to `{ signature, address }`.
 */
export function signEthereumMessage(
  path: string,
  messageHex: string,
): {
  request: TrezorRequest;
  response: Promise<{ signature: string; address: string }>;
} {
  return getTrezorBridge().call<{ signature: string; address: string }>(
    "ethereumSignMessage",
    { path, message: messageHex, hex: true },
  );
}

/**
 * Convenience: sign an EIP-1559 (type 2) transaction on the Trezor.
 *
 * @param path - BIP44 derivation path.
 * @param transaction - Trezor's EthereumTransactionEIP1559 shape.
 * @returns Request envelope + response promise resolving to `{ r, s, v }`.
 */
export function signEthereumTransaction(
  path: string,
  transaction: Record<string, unknown>,
): {
  request: TrezorRequest;
  response: Promise<{ r: string; s: string; v: string }>;
} {
  return getTrezorBridge().call<{ r: string; s: string; v: string }>(
    "ethereumSignTransaction",
    { path, transaction },
  );
}
