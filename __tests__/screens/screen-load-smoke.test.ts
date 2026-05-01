/**
 * Module-load smoke tests for the five highest-value screens.
 *
 * Component-render tests via `@testing-library/react-native` + jest-expo
 * would require a second jest project (different preset, different
 * jsdom env) and a non-trivial native-module mock surface. The
 * highest-ROI smaller test is verifying these modules even *load* —
 * which catches:
 *   - Broken imports (renames, deleted exports, dangling path aliases)
 *   - Top-level statements that throw (e.g. accidentally calling a
 *     hook outside a component)
 *   - Mis-shapen default exports (no longer a React function component)
 *
 * These are the realistic regression vectors as the codebase moves;
 * the per-screen interaction asserts (Phase 8 Week 2) belong in a
 * separate jest project once the jest-expo setup lands.
 */

// Most screens transitively import from `react-native`. Mock it down
// to the surface our screens reach for so the modules load under the
// existing `node` env. This mirrors what jest-expo would inject.
jest.mock("react-native", () => {
  function passthrough({ children }: { children?: unknown }): unknown {
    return children ?? null;
  }
  function noop(): void {
    /* noop */
  }
  return {
    Platform: { OS: "ios", select: (o: Record<string, unknown>) => o["ios"] ?? o["default"] },
    Alert: { alert: noop },
    Linking: { openURL: noop, canOpenURL: () => Promise.resolve(true) },
    StyleSheet: { create: <T,>(s: T): T => s, hairlineWidth: 1 },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    View: passthrough,
    Text: passthrough,
    TextInput: passthrough,
    ScrollView: passthrough,
    Pressable: passthrough,
    TouchableOpacity: passthrough,
    Image: passthrough,
    ActivityIndicator: passthrough,
    RefreshControl: passthrough,
    Switch: passthrough,
    Modal: passthrough,
    SafeAreaView: passthrough,
    KeyboardAvoidingView: passthrough,
  };
});

jest.mock("@shopify/flash-list", () => ({
  FlashList: ({ children }: { children?: unknown }) => children ?? null,
}));

jest.mock("react-native-svg", () => {
  function passthrough(): unknown {
    return null;
  }
  return {
    __esModule: true,
    default: passthrough,
    Svg: passthrough,
    Polyline: passthrough,
    Path: passthrough,
    Circle: passthrough,
    Rect: passthrough,
    G: passthrough,
    Text: passthrough,
  };
});

jest.mock("react-native-qrcode-svg", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("react-native-webview", () => ({
  __esModule: true,
  WebView: () => null,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _k,
    i18n: { language: "en", changeLanguage: jest.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => Promise.resolve() },
}));

jest.mock("../../src/i18n", () => ({
  __esModule: true,
  default: { language: "en", changeLanguage: jest.fn() },
}));

// @expo/vector-icons is shipped as ESM and cannot be parsed by ts-jest
// without a transformIgnorePatterns escape hatch. Stub the icon-set
// exports as null components so any screen that pulls them in (via
// ScreenHeader, BottomNav, etc.) loads without crashing.
jest.mock("@expo/vector-icons", () => ({
  __esModule: true,
  Ionicons: () => null,
  MaterialIcons: () => null,
  MaterialCommunityIcons: () => null,
  Feather: () => null,
  FontAwesome: () => null,
  FontAwesome5: () => null,
  AntDesign: () => null,
  Entypo: () => null,
  EvilIcons: () => null,
  Foundation: () => null,
  Octicons: () => null,
  SimpleLineIcons: () => null,
  Zocial: () => null,
}));

// expo-clipboard is shipped as ESM. WalletConnectBar uses
// `Clipboard.setStringAsync(uri)` to copy the WC pairing URI.
jest.mock("expo-clipboard", () => ({
  __esModule: true,
  setStringAsync: jest.fn().mockResolvedValue(true),
  getStringAsync: jest.fn().mockResolvedValue(""),
}));

describe("Screen modules load without errors", () => {
  const SCREENS = [
    { name: "WelcomeScreen", path: "../../src/screens/WelcomeScreen" },
    { name: "SwapScreen", path: "../../src/screens/SwapScreen" },
    { name: "NFTDetailScreen", path: "../../src/screens/NFTDetailScreen" },
    {
      name: "PredictionsMarketDetailScreen",
      path: "../../src/screens/PredictionsMarketDetailScreen",
    },
    { name: "P2PListingDetailScreen", path: "../../src/screens/P2PListingDetailScreen" },
  ];

  it.each(SCREENS)("$name loads + default-exports a function", ({ path }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(path) as { default?: unknown };
    expect(typeof mod.default).toBe("function");
  });
});
