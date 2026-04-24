/**
 * MobileBLEAdapter — Bluetooth Low Energy transport for Ledger Nano X.
 *
 * Implements the `@wallet/platform/adapters::BLEAdapter` contract using
 * `react-native-ble-plx` (when it's installed) and wraps each peripheral
 * in a Ledger-compatible `BLETransport` (APDU over the Nordic UART
 * service UUIDs Ledger ships in production firmware).
 *
 * The dependency is loaded lazily via a dynamic require so users who
 * never open a hardware-sign screen don't pay the bundle-size cost. If
 * the module is not installed (Mobile is pre-native-prebuild right now),
 * all methods throw a descriptive error instead of crashing the app.
 *
 * Consumer wiring:
 *   1. Call `registerHardwareAdapters()` from `HardwareSignScreen.tsx`
 *      (lazy — first hardware tap only).
 *   2. `@wallet/services/hardware/LedgerService` picks this up via
 *      `getBLEAdapter()` automatically.
 */

import type {
  BLEAdapter,
  BLEDevice,
  BLETransport,
} from '@wallet/platform/adapters';

/** Ledger Live's canonical Nordic UART service UUID (primary service). */
const LEDGER_SERVICE_UUID = '13d63400-2c97-0004-0000-4c6564676572';
/** RX characteristic (phone → device). */
const LEDGER_RX_CHAR_UUID = '13d63400-2c97-0004-0002-4c6564676572';
/** TX characteristic (device → phone). */
const LEDGER_TX_CHAR_UUID = '13d63400-2c97-0004-0001-4c6564676572';

/** 60s scan budget — covers "press both buttons to wake" on Nano X. */
const DEFAULT_SCAN_MS = 60_000;

type BleManagerCtor = new () => BleManagerInstance;

interface BleManagerInstance {
  startDeviceScan: (
    serviceUuids: string[] | null,
    options: unknown,
    callback: (err: unknown, device: BlePlxDevice | null) => void,
  ) => void;
  stopDeviceScan: () => void;
  connectToDevice: (id: string, options?: unknown) => Promise<BlePlxDevice>;
  destroy: () => void;
}

interface BlePlxDevice {
  id: string;
  name?: string | null;
  rssi?: number | null;
  discoverAllServicesAndCharacteristics: () => Promise<BlePlxDevice>;
  writeCharacteristicWithoutResponseForService: (
    serviceUuid: string,
    characteristicUuid: string,
    value: string,
  ) => Promise<unknown>;
  monitorCharacteristicForService: (
    serviceUuid: string,
    characteristicUuid: string,
    cb: (err: unknown, characteristic: { value?: string | null } | null) => void,
  ) => { remove: () => void };
  cancelConnection: () => Promise<unknown>;
}

/**
 * Load `react-native-ble-plx` on demand. Throws a clear error when the
 * module is not installed (Mobile has the dep listed but, pre-prebuild,
 * the native side isn't linked). Callers should surface the error in UI.
 *
 * @returns The exported `BleManager` class.
 */
function loadBleManager(): BleManagerCtor {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-ble-plx') as {
      BleManager?: BleManagerCtor;
    };
    if (mod.BleManager === undefined) {
      throw new Error('react-native-ble-plx: BleManager export not found');
    }
    return mod.BleManager;
  } catch (err) {
    throw new Error(
      `Bluetooth is not available on this build. Run \`expo prebuild && expo run:ios\` ` +
        `(or run:android) with \`react-native-ble-plx\` installed. Underlying error: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Base64-encode an APDU for `writeCharacteristicWithoutResponseForService`.
 *
 * @param bytes - Raw APDU bytes.
 * @returns Base64-encoded string.
 */
function toBase64(bytes: Uint8Array): string {
  // Node/React Native both expose Buffer via the polyfill layer.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Buffer = (require('buffer') as { Buffer: { from(b: Uint8Array): { toString: (enc: string) => string } } }).Buffer;
  return Buffer.from(bytes).toString('base64');
}

/**
 * Decode a base64 chunk from a BLE notification into raw bytes.
 *
 * @param b64 - Base64 string.
 * @returns Raw bytes.
 */
function fromBase64(b64: string): Uint8Array {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Buffer = (require('buffer') as { Buffer: { from(b: string, enc: string): Uint8Array } }).Buffer;
  return Buffer.from(b64, 'base64');
}

/**
 * React Native BLE adapter compatible with the Wallet extension's
 * BLEAdapter contract.
 */
export class MobileBLEAdapter implements BLEAdapter {
  private manager: BleManagerInstance | undefined;

  /**
   * Lazy-init the BleManager. The Expo BLE permission prompts surface the
   * first time we touch the manager, so we keep creation out of the cold-
   * start path and only instantiate on scan / connect.
   *
   * @returns Shared BleManager instance.
   */
  private ensureManager(): BleManagerInstance {
    if (this.manager === undefined) {
      const Ctor = loadBleManager();
      this.manager = new Ctor();
    }
    return this.manager;
  }

  /** @inheritdoc */
  async scan(timeoutMs: number = DEFAULT_SCAN_MS): Promise<BLEDevice[]> {
    const manager = this.ensureManager();
    const found = new Map<string, BLEDevice>();
    return new Promise<BLEDevice[]>((resolve, reject) => {
      const stop = (): void => {
        try {
          manager.stopDeviceScan();
        } catch {
          /* already stopped */
        }
      };
      const timer = setTimeout(() => {
        stop();
        resolve(Array.from(found.values()));
      }, Math.max(1_000, timeoutMs));
      try {
        manager.startDeviceScan([LEDGER_SERVICE_UUID], null, (err, device) => {
          if (err !== null && err !== undefined) {
            clearTimeout(timer);
            stop();
            reject(err instanceof Error ? err : new Error(String(err)));
            return;
          }
          if (device !== null && device.name !== undefined && device.name !== null) {
            found.set(device.id, {
              id: device.id,
              name: device.name,
              ...(device.rssi !== null && device.rssi !== undefined && { rssi: device.rssi }),
            });
          }
        });
      } catch (err) {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /** @inheritdoc */
  async connect(deviceId: string): Promise<BLETransport> {
    const manager = this.ensureManager();
    const device = await manager.connectToDevice(deviceId, { requestMTU: 156 });
    await device.discoverAllServicesAndCharacteristics();
    return new LedgerBleTransport(device);
  }
}

/**
 * Concrete transport layered on top of a connected BLE device. Speaks
 * APDU + Ledger's BLE framing (0x05 header + sequence + payload).
 */
class LedgerBleTransport implements BLETransport {
  private readonly device: BlePlxDevice;
  private monitor: { remove: () => void } | undefined;

  /**
   * @param device - Connected BLE device.
   */
  constructor(device: BlePlxDevice) {
    this.device = device;
  }

  /** @inheritdoc */
  async send(apdu: Uint8Array): Promise<Uint8Array> {
    // Ledger BLE frames: { 0x05, seqHi, seqLo, [lenHi, lenLo on seq 0], payload }
    // We assemble the response across however many notifications the
    // device sends and return just the raw APDU response payload.
    const framed = this.frameApdu(apdu);
    const b64 = toBase64(framed);
    return new Promise<Uint8Array>((resolve, reject) => {
      let totalLen = 0;
      let collected = new Uint8Array(0);
      this.monitor = this.device.monitorCharacteristicForService(
        LEDGER_SERVICE_UUID,
        LEDGER_TX_CHAR_UUID,
        (err, characteristic) => {
          if (err !== null && err !== undefined) {
            this.monitor?.remove();
            reject(err instanceof Error ? err : new Error(String(err)));
            return;
          }
          const value = characteristic?.value;
          if (value === null || value === undefined) return;
          const bytes = fromBase64(value);
          // Chunk format: 0x05 | seq (2) | [len (2) when seq==0] | payload
          const isFirst = bytes[1] === 0 && bytes[2] === 0;
          const payloadStart = isFirst ? 5 : 3;
          if (isFirst) {
            totalLen = ((bytes[3] ?? 0) << 8) | (bytes[4] ?? 0);
          }
          const chunk = bytes.slice(payloadStart);
          const merged = new Uint8Array(collected.length + chunk.length);
          merged.set(collected, 0);
          merged.set(chunk, collected.length);
          collected = merged;
          if (collected.length >= totalLen) {
            this.monitor?.remove();
            resolve(collected.slice(0, totalLen));
          }
        },
      );
      void this.device
        .writeCharacteristicWithoutResponseForService(
          LEDGER_SERVICE_UUID,
          LEDGER_RX_CHAR_UUID,
          b64,
        )
        .catch((writeErr: unknown) => {
          this.monitor?.remove();
          reject(writeErr instanceof Error ? writeErr : new Error(String(writeErr)));
        });
    });
  }

  /** @inheritdoc */
  async close(): Promise<void> {
    try {
      this.monitor?.remove();
    } catch {
      /* already removed */
    }
    try {
      await this.device.cancelConnection();
    } catch {
      /* already disconnected */
    }
  }

  /**
   * Apply Ledger BLE framing to a raw APDU.
   *
   * @param apdu - Raw APDU bytes.
   * @returns Framed bytes (single packet; multi-packet writes are not
   *   needed for `signMessage` / `signTransaction` at typical sizes).
   */
  private frameApdu(apdu: Uint8Array): Uint8Array {
    const header = new Uint8Array(5);
    header[0] = 0x05; // data tag
    header[1] = 0x00; // seq high
    header[2] = 0x00; // seq low
    header[3] = (apdu.length >> 8) & 0xff;
    header[4] = apdu.length & 0xff;
    const out = new Uint8Array(header.length + apdu.length);
    out.set(header, 0);
    out.set(apdu, header.length);
    return out;
  }
}
