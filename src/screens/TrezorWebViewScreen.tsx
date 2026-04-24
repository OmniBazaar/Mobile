/**
 * TrezorWebViewScreen — hosts `https://connect.trezor.io/9/` in a
 * WebView and forwards postMessage traffic between it and
 * `TrezorBridgeService`.
 *
 * The WebView is the only place where Trezor Connect runs on Mobile —
 * there is no native Trezor SDK for React Native. Messages flow:
 *
 *   React Native → WebView  (via `injectedJavaScript` that wraps
 *                             `window.postMessage` with a helper the
 *                             WebView calls to deliver requests)
 *   WebView → React Native  (via `onMessage` event)
 *
 * Every `TrezorRequest` is JSON-serialised and posted into the
 * iframe's message queue. Responses come back on the same channel
 * and are routed through `TrezorBridge.onMessage`.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import type { WebView as WebViewType } from "react-native-webview";
import { useTranslation } from "react-i18next";

import { colors } from "@theme/colors";
import {
  getTrezorBridge,
  type TrezorRequest,
  type TrezorResponse,
} from "../services/TrezorBridgeService";

/** Props. */
export interface TrezorWebViewScreenProps {
  /** Back-nav. */
  onBack: () => void;
}

/** URL of the hosted Trezor Connect page. Pinned to the v9 popup. */
const TREZOR_CONNECT_URL = "https://connect.trezor.io/9/popup.html";

/**
 * Tiny bootstrap that runs inside the WebView before Connect loads.
 * Exposes a `window.OmniBazaarTrezor.send(json)` hook the native side
 * invokes (via `injectJavaScript`) to forward outbound requests, and
 * pipes inbound Connect responses back to RN via `window.ReactNativeWebView.postMessage`.
 */
const INJECTED_JS = `
  (function () {
    if (window.OmniBazaarTrezor) return;
    function dispatch(envelope) {
      try {
        var parsed = typeof envelope === 'string' ? JSON.parse(envelope) : envelope;
        window.postMessage(parsed, '*');
      } catch (err) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          id: 'bootstrap-error',
          success: false,
          error: String(err && err.message ? err.message : err),
        }));
      }
    }
    window.addEventListener('message', function (event) {
      // Forward every message the Connect iframe emits so the RN
      // bridge can filter by id. Connect emits lifecycle events
      // (TRANSPORT, IFRAME_LOADED) that the bridge ignores.
      if (event.data && typeof event.data === 'object') {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify(event.data));
        } catch (_serializationError) {
          /* non-serialisable payloads (e.g. cycles) are dropped. */
        }
      }
    });
    window.OmniBazaarTrezor = { send: dispatch };
    true;
  })();
`;

/**
 * Render the Trezor WebView + post/receive plumbing.
 * @param props - See {@link TrezorWebViewScreenProps}.
 * @returns JSX.
 */
export default function TrezorWebViewScreen(
  props: TrezorWebViewScreenProps,
): JSX.Element {
  const { t } = useTranslation();
  const { onBack } = props;
  const webviewRef = useRef<WebViewType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  // Forward outbound requests the bridge builds into the WebView as
  // injected JS. A tiny polling flush keeps the queue drained even if
  // a request was built before the WebView finished loading.
  const flushRequest = useCallback((request: TrezorRequest): void => {
    const view = webviewRef.current;
    if (view === null) return;
    view.injectJavaScript(
      `window.OmniBazaarTrezor && window.OmniBazaarTrezor.send(${JSON.stringify(
        request,
      )}); true;`,
    );
  }, []);

  useEffect(() => {
    const bridge = getTrezorBridge();
    // Patch the bridge's `call` so every new request flushes
    // immediately. The cast preserves the original generic signature
    // while letting us wrap the return value (TS can't infer through
    // `.bind` + reassignment when `call` carries a method-level
    // generic).
    const originalCall = bridge.call.bind(bridge);
    bridge.call = ((method: TrezorRequest["method"], params: Record<string, unknown>) => {
      const handle = originalCall(method, params);
      flushRequest(handle.request);
      return handle;
    }) as typeof bridge.call;
    return (): void => {
      bridge.call = originalCall;
      bridge.cancelAll("TrezorWebView unmounted");
    };
  }, [flushRequest]);

  const onMessage = useCallback((event: { nativeEvent: { data: string } }): void => {
    const bridge = getTrezorBridge();
    try {
      const parsed = JSON.parse(event.nativeEvent.data) as
        | TrezorResponse
        | { type?: string };
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "id" in parsed &&
        typeof (parsed as TrezorResponse).id === "string"
      ) {
        bridge.onMessage(parsed as TrezorResponse);
      }
    } catch {
      /* malformed frame — drop. */
    }
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backRow} accessibilityRole="button">
          <Text style={styles.back}>
            ← {t("common.back", { defaultValue: "Back" })}
          </Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t("hardware.trezor", { defaultValue: "Trezor" })}
        </Text>
        <Text style={styles.sub}>
          {t("hardware.trezorLoading", {
            defaultValue:
              "Connect your Trezor and unlock it when prompted. The hosted Trezor Connect page below drives signing.",
          })}
        </Text>
      </View>
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      {error !== undefined && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      <WebView
        ref={webviewRef}
        source={{ uri: TREZOR_CONNECT_URL }}
        injectedJavaScriptBeforeContentLoaded={INJECTED_JS}
        onMessage={onMessage}
        onLoadEnd={() => setLoading(false)}
        onError={(e) => setError(String(e.nativeEvent.description ?? "WebView error"))}
        style={styles.webview}
        originWhitelist={["https://connect.trezor.io"]}
        // Trezor Connect requires a real user-agent string; leave it
        // default so the page doesn't serve the "unsupported browser"
        // fallback.
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  backRow: { paddingVertical: 8 },
  back: { color: colors.primary, fontSize: 14 },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: "700", marginTop: 4 },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 18 },
  loading: { alignItems: "center", paddingVertical: 16 },
  error: { color: colors.danger, fontSize: 13, paddingHorizontal: 16, paddingVertical: 8 },
  webview: { flex: 1 },
});
