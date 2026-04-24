/**
 * MobileUSBHIDAdapter — USB-HID transport for Ledger Nano S Plus on
 * Android (USB-C). iOS does not expose a HID API, so this adapter is
 * a no-op there; callers should feature-detect via `Platform.OS` and
 * only register it on Android.
 *
 * Wraps `@ledgerhq/hw-transport-react-native-hid` (when installed),
 * adapting the Ledger transport surface onto the
 * `@wallet/platform/adapters::USBHIDAdapter` contract the extension
 * already consumes. Loaded lazily so the 300 KB native module cost
 * only shows up for users who actually plug a Ledger in.
 *
 * If the native module isn't installed (pre-prebuild), every method
 * throws with a clear migration hint.
 */

import type {
  USBHIDAdapter,
  USBHIDDevice,
  USBHIDTransport,
} from "@wallet/platform/adapters";

interface LedgerHidTransport {
  send: (
    cla: number,
    ins: number,
    p1: number,
    p2: number,
    data: Uint8Array,
  ) => Promise<Uint8Array>;
  exchange: (apdu: Uint8Array) => Promise<Uint8Array>;
  close: () => Promise<void>;
  deviceModel?: { productName?: string; id?: string };
}

interface LedgerHidStatic {
  list: () => Promise<LedgerHidDeviceDesc[]>;
  open: (descriptor: LedgerHidDeviceDesc) => Promise<LedgerHidTransport>;
}

interface LedgerHidDeviceDesc {
  vendorId: number;
  productId: number;
  productName?: string;
  deviceId?: number | string;
}

/**
 * Load `@ledgerhq/hw-transport-react-native-hid` on demand. Throws a
 * descriptive error when the module / native linkage is missing.
 *
 * @returns The default export (`TransportHID`) with its static `list`
 *   and `open` methods.
 */
function loadTransport(): LedgerHidStatic {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@ledgerhq/hw-transport-react-native-hid") as {
      default?: LedgerHidStatic;
    };
    if (mod.default === undefined) {
      throw new Error(
        "@ledgerhq/hw-transport-react-native-hid: default export missing",
      );
    }
    return mod.default;
  } catch (err) {
    throw new Error(
      `USB-HID is not available on this build. Install ` +
        `\`@ledgerhq/hw-transport-react-native-hid\` and run ` +
        `\`expo prebuild && expo run:android\`. Underlying error: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Compose a stable device id string from the HID descriptor. Ledger
 * doesn't expose a serial number, so we fall back to
 * `vid:pid@productName` which is good enough to distinguish the two
 * Nano models a user might plug in at once.
 *
 * @param desc - HID device descriptor.
 * @returns Stable id string.
 */
function descriptorId(desc: LedgerHidDeviceDesc): string {
  if (desc.deviceId !== undefined) {
    return String(desc.deviceId);
  }
  return `${desc.vendorId}:${desc.productId}@${desc.productName ?? "ledger"}`;
}

/**
 * React Native Android USB-HID adapter. Satisfies the Wallet extension's
 * `USBHIDAdapter` contract.
 */
export class MobileUSBHIDAdapter implements USBHIDAdapter {
  private readonly TransportHID: LedgerHidStatic;
  /** Most-recently-enumerated descriptors, keyed by adapter id. */
  private descriptors: Map<string, LedgerHidDeviceDesc> = new Map();

  /**
   * Eagerly-load the native transport so the first scan/open call
   * inherits a fully-initialised module. Errors here surface at
   * registration time rather than on first use.
   */
  constructor() {
    this.TransportHID = loadTransport();
  }

  /** @inheritdoc */
  async enumerate(): Promise<USBHIDDevice[]> {
    const list = await this.TransportHID.list();
    this.descriptors = new Map(list.map((d) => [descriptorId(d), d]));
    return list.map((d) => ({
      id: descriptorId(d),
      productName: d.productName ?? "Ledger Nano",
      vendorId: d.vendorId,
      productId: d.productId,
    }));
  }

  /** @inheritdoc */
  async open(deviceId: string): Promise<USBHIDTransport> {
    let descriptor = this.descriptors.get(deviceId);
    if (descriptor === undefined) {
      // `enumerate` hasn't run yet — best-effort re-list so `open`
      // doesn't fail for the first-call case.
      const list = await this.TransportHID.list();
      this.descriptors = new Map(list.map((d) => [descriptorId(d), d]));
      descriptor = this.descriptors.get(deviceId);
    }
    if (descriptor === undefined) {
      throw new Error(`USB-HID device ${deviceId} not found`);
    }
    const transport = await this.TransportHID.open(descriptor);
    return new LedgerHidTransportAdapter(transport);
  }
}

/**
 * Wrap a raw `@ledgerhq/hw-transport-react-native-hid` transport in the
 * narrow `USBHIDTransport` interface Mobile's consumers expect (a
 * single `send(apdu) → apdu` method plus `close()`).
 */
class LedgerHidTransportAdapter implements USBHIDTransport {
  private readonly transport: LedgerHidTransport;

  /**
   * @param transport - The raw `TransportHID` instance.
   */
  constructor(transport: LedgerHidTransport) {
    this.transport = transport;
  }

  /** @inheritdoc */
  async send(apdu: Uint8Array): Promise<Uint8Array> {
    // `exchange` accepts a raw APDU buffer and returns the response
    // bytes (including the trailing 2-byte SW). Avoids us re-parsing
    // cla/ins/p1/p2 just to feed them back through `send`.
    return this.transport.exchange(apdu);
  }

  /** @inheritdoc */
  async close(): Promise<void> {
    await this.transport.close();
  }
}
