/**
 * WalletConnectService — connect Mobile Swap to an external EVM wallet
 * via WalletConnect v2.
 *
 * The OB Mobile app is itself a self-custodial wallet (mnemonic in memory),
 * but users frequently keep funds on Rainbow / MetaMask Mobile / Trust /
 * Coinbase Wallet / Ledger Live mobile / etc. WalletConnect v2 lets Mobile
 * relay sign + send-transaction requests to any of those wallets without
 * the user having to import their seed here.
 *
 * Design:
 *   - Lazy init — the SignClient and its websocket aren't created until
 *     the first connect attempt, so users who only ever use the embedded
 *     mnemonic don't pay the bundle cost or the relay handshake.
 *   - Single active session — Mobile Swap pairs with one wallet at a time.
 *     Add wallets the user can pre-pair to ConnectedSitesScreen if needed.
 *   - OmniCoin L1 (chain 88008) is intentionally absent from
 *     `requiredNamespaces.eip155.chains`. External wallets cannot sign
 *     EIP-2771 meta-transactions for OmniRelay; routes that need the
 *     embedded wallet are filtered upstream by `swapRouteClassification`.
 *
 * Project ID resolution:
 *   - `process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID` (Expo public env)
 *   - or `Constants.expoConfig.extra.walletConnectProjectId` (app.json)
 *   When unset we throw a `MissingProjectIdError` from `connect()` so the UI
 *   can render a clear "configure WalletConnect project id" hint instead
 *   of a generic websocket failure.
 *
 * @module services/WalletConnectService
 */
import '@walletconnect/react-native-compat';
import { getStorageAdapter } from '@wallet/platform/registry';
import SignClient from '@walletconnect/sign-client';
import type { SessionTypes } from '@walletconnect/types';
import Constants from 'expo-constants';

/** Chain ID for OmniCoin L1 — intentionally NOT in the WC namespace. */
export const OMNICOIN_L1_CHAIN_ID = 88008;

/**
 * The set of EVM chain IDs we offer in the WalletConnect required-namespace.
 * Mirrors the chains the WebApp + IntentRouter currently route routes
 * through. Hardware-wallet-pinned dapps may only support a subset; that's
 * negotiated by the wallet at session-approval time.
 */
const SUPPORTED_CHAINS: readonly number[] = [
  1, // Ethereum mainnet
  10, // Optimism
  56, // BNB Smart Chain
  137, // Polygon
  324, // zkSync Era
  8453, // Base
  42161, // Arbitrum One
  43114, // Avalanche C-Chain
  59144, // Linea
];

/**
 * Methods the wallet must support for a Mobile Swap. Excludes the OmniRelay
 * forwarder typed-data signing; external wallets aren't asked to sign that.
 */
const REQUIRED_METHODS: readonly string[] = [
  'eth_sendTransaction',
  'eth_signTypedData_v4',
  'personal_sign',
  'wallet_switchEthereumChain',
];

/** WalletConnect-required event subscriptions. */
const REQUIRED_EVENTS: readonly string[] = ['chainChanged', 'accountsChanged'];

/** Storage key under which the active session topic is persisted. */
const SESSION_TOPIC_KEY = 'walletConnect.activeSessionTopic';

/** Snapshot of the current external-wallet connection. */
export interface WalletConnectConnection {
  /** Lower-case 0x-prefixed account address. */
  address: string;
  /** Chain ID currently active in the wallet (best-effort). */
  chainId: number;
  /** Wallet metadata as advertised by the peer (name, url, icon). */
  peerName: string;
  /** Underlying WC session topic — useful for debugging. */
  topic: string;
}

/** Returned by `connect()` to drive the QR / deep-link UI. */
export interface ConnectInProgress {
  /** WC `wc:` URI — render as QR or open as a deep link. */
  uri: string;
  /** Resolves with the connection once the wallet approves. */
  approval: Promise<WalletConnectConnection>;
  /** Cancel a pending pairing (closes the proposal). */
  cancel: () => void;
}

/** Thrown when the project id env is not configured. */
export class MissingProjectIdError extends Error {
  /** @inheritdoc */
  public readonly code = 'WC_MISSING_PROJECT_ID';

  /** Construct with default message. */
  constructor() {
    super(
      'WalletConnect project id is not configured. ' +
        'Set EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID or app.json extra.walletConnectProjectId.',
    );
    this.name = 'MissingProjectIdError';
  }
}

/** Resolve a WC project id from the available config sources. */
function resolveProjectId(): string {
  // EXPO_PUBLIC_* envs are statically inlined by Metro at build time, which
  // is why the literal access is required (the eslint rule enforces this).
  const fromEnv = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (typeof fromEnv === 'string' && fromEnv !== '') return fromEnv;

  // Fallback: app.json -> expo.extra.walletConnectProjectId. We type-narrow
  // through `unknown` because Constants.expoConfig is typed loosely.
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const id = extra['walletConnectProjectId'];
  if (typeof id === 'string' && id !== '') return id;
  return '';
}

/**
 * Singleton wrapper around `@walletconnect/sign-client`.
 *
 * Most of the lifecycle is hidden inside this class so the screens just
 * call `connect()` / `disconnect()` / `sendTransaction()` and don't have
 * to deal with WC topics, namespaces, or session expiry.
 */
class WalletConnectService {
  /** Lazily-created signer instance. */
  private client: InstanceType<typeof SignClient> | null = null;
  /** Topic of the currently active session, if any. */
  private activeTopic: string | null = null;
  /** Last-seen connection snapshot (mirrored from the WC session). */
  private currentConnection: WalletConnectConnection | null = null;
  /** Set of subscribers notified on connection state changes. */
  private listeners = new Set<(c: WalletConnectConnection | null) => void>();

  /**
   * Subscribe to connection-change events. Callback fires immediately with
   * the current state so consumers don't need a separate seed read.
   *
   * @param fn - Listener invoked on connect/disconnect/chain-change.
   * @returns Unsubscribe function.
   */
  onChange(fn: (c: WalletConnectConnection | null) => void): () => void {
    this.listeners.add(fn);
    fn(this.currentConnection);
    return (): void => {
      this.listeners.delete(fn);
    };
  }

  /** Read the current connection state (or null when not connected). */
  getConnection(): WalletConnectConnection | null {
    return this.currentConnection;
  }

  /**
   * Begin a new pairing. Returns the WC `uri` so the UI can render a QR
   * (or a "Open in wallet" deep link) and the `approval` promise that
   * resolves once the user approves on their other-wallet device.
   *
   * Cancels any in-progress pairing if called twice.
   *
   * @returns Pairing handle (uri + approval).
   */
  async connect(): Promise<ConnectInProgress> {
    const client = await this.getClient();

    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        eip155: {
          chains: SUPPORTED_CHAINS.map((c) => `eip155:${c}`),
          methods: [...REQUIRED_METHODS],
          events: [...REQUIRED_EVENTS],
        },
      },
    });
    if (uri === undefined) {
      throw new Error('WalletConnect did not return a pairing URI.');
    }

    const wrappedApproval = approval().then(async (session) => {
      const connection = this.snapshotFromSession(session);
      this.activeTopic = session.topic;
      this.currentConnection = connection;
      try {
        await getStorageAdapter().setItem(SESSION_TOPIC_KEY, session.topic);
      } catch {
        // Persistence failure isn't fatal — session is still live in
        // memory. Worst case the user has to re-pair next launch.
      }
      this.notify();
      return connection;
    });

    return {
      uri,
      approval: wrappedApproval,
      cancel: (): void => {
        // No-op for the proposer once the URI is out — WC v2 doesn't
        // expose a cancel-proposal API. The approval promise will reject
        // when the proposal expires (5 min).
      },
    };
  }

  /**
   * Tear down the active session if one exists. Safe to call when not
   * connected — it just clears local state.
   *
   * @returns Resolves once the disconnect has been sent (or skipped).
   */
  async disconnect(): Promise<void> {
    const client = this.client;
    const topic = this.activeTopic;
    this.activeTopic = null;
    this.currentConnection = null;
    try {
      await getStorageAdapter().setItem(SESSION_TOPIC_KEY, '');
    } catch {
      // Non-fatal.
    }
    if (client !== null && topic !== null) {
      try {
        await client.disconnect({
          topic,
          reason: { code: 6000, message: 'User initiated' },
        });
      } catch {
        // The remote may already be disconnected; we still count the
        // local session as gone.
      }
    }
    this.notify();
  }

  /**
   * Send an unsigned transaction through the connected wallet. The wallet
   * pops up a confirmation; we resolve with the broadcast tx hash.
   *
   * @param chainId - Target chain id (must be in the connected namespace).
   * @param tx - Eth-style transaction payload — `to`, `data`, optional
   *   `value` (hex string). Caller is responsible for wei encoding.
   * @returns On-chain transaction hash.
   * @throws Error when not connected, or when the wallet rejects the request.
   */
  async sendTransaction(
    chainId: number,
    tx: { from: string; to: string; data: string; value?: string },
  ): Promise<string> {
    const client = await this.getClient();
    const topic = this.activeTopic;
    if (topic === null || this.currentConnection === null) {
      throw new Error(
        'No active WalletConnect session. Connect a wallet first.',
      );
    }
    const result = (await client.request({
      topic,
      chainId: `eip155:${chainId}`,
      request: {
        method: 'eth_sendTransaction',
        params: [tx],
      },
    })) as string;
    if (typeof result !== 'string' || !result.startsWith('0x')) {
      throw new Error(
        `Wallet returned an unexpected response for eth_sendTransaction: ${String(result)}`,
      );
    }
    return result;
  }

  /**
   * Lazy-init the WC SignClient on first use. Idempotent.
   *
   * @returns Initialised client.
   */
  private async getClient(): Promise<InstanceType<typeof SignClient>> {
    if (this.client !== null) return this.client;
    const projectId = resolveProjectId();
    if (projectId === '') {
      throw new MissingProjectIdError();
    }
    this.client = await SignClient.init({
      projectId,
      metadata: {
        name: 'OmniBazaar Mobile',
        description: 'OmniBazaar mobile wallet — Universal Swap',
        url: 'https://omnibazaar.com',
        icons: ['https://omnibazaar.com/icon.png'],
      },
    });
    this.attachListeners(this.client);
    await this.restorePersistedSession(this.client);
    return this.client;
  }

  /**
   * Restore the active session (if any) from the SignClient's own
   * persistence. WC v2 keeps sessions alive across app restarts; we just
   * pick up whichever topic we previously stored.
   *
   * @param client - Initialised SignClient.
   */
  private async restorePersistedSession(
    client: InstanceType<typeof SignClient>,
  ): Promise<void> {
    let storedTopic = '';
    try {
      const v = await getStorageAdapter().getItem<string>(SESSION_TOPIC_KEY);
      storedTopic = v ?? '';
    } catch {
      storedTopic = '';
    }
    if (storedTopic === '') return;
    const sessions = client.session.getAll();
    const match = sessions.find((s) => s.topic === storedTopic);
    if (match === undefined) return;
    if (match.expiry * 1000 <= Date.now()) {
      await client.disconnect({
        topic: match.topic,
        reason: { code: 6000, message: 'expired' },
      });
      return;
    }
    this.activeTopic = match.topic;
    this.currentConnection = this.snapshotFromSession(match);
    this.notify();
  }

  /** Wire up the SignClient's session-lifecycle events. */
  private attachListeners(client: InstanceType<typeof SignClient>): void {
    client.on('session_delete', ({ topic }) => {
      if (topic === this.activeTopic) {
        this.activeTopic = null;
        this.currentConnection = null;
        this.notify();
      }
    });
    client.on('session_update', ({ topic, params }) => {
      if (topic !== this.activeTopic || this.currentConnection === null) return;
      const namespaces = params.namespaces;
      const eip = namespaces['eip155'];
      const account = eip?.accounts[0];
      if (account === undefined) return;
      const [, chainStr, addr] = account.split(':');
      this.currentConnection = {
        ...this.currentConnection,
        ...(addr !== undefined && { address: addr.toLowerCase() }),
        ...(chainStr !== undefined && {
          chainId: Number.parseInt(chainStr, 10),
        }),
      };
      this.notify();
    });
    client.on('session_event', ({ topic, params }) => {
      if (topic !== this.activeTopic || this.currentConnection === null) return;
      if (params.event.name === 'chainChanged') {
        const newChain = Number(params.event.data);
        if (Number.isFinite(newChain)) {
          this.currentConnection = {
            ...this.currentConnection,
            chainId: newChain,
          };
          this.notify();
        }
      } else if (params.event.name === 'accountsChanged') {
        const data = params.event.data as unknown;
        if (Array.isArray(data) && typeof data[0] === 'string') {
          this.currentConnection = {
            ...this.currentConnection,
            address: (data[0] as string).toLowerCase(),
          };
          this.notify();
        }
      }
    });
  }

  /** Build a snapshot from a fully-approved session. */
  private snapshotFromSession(
    session: SessionTypes.Struct,
  ): WalletConnectConnection {
    const eip = session.namespaces['eip155'];
    const account = eip?.accounts[0] ?? '';
    const [, chainStr, addr] = account.split(':');
    return {
      address: (addr ?? '').toLowerCase(),
      chainId: chainStr !== undefined ? Number.parseInt(chainStr, 10) : 0,
      peerName: session.peer.metadata.name,
      topic: session.topic,
    };
  }

  /** Fan out the current state to all subscribers. */
  private notify(): void {
    for (const fn of this.listeners) {
      try {
        fn(this.currentConnection);
      } catch {
        // Listeners must not break the bus.
      }
    }
  }
}

/** Singleton instance. */
const instance = new WalletConnectService();

/**
 * Get the WalletConnect singleton.
 *
 * @returns The shared {@link WalletConnectService}.
 */
export function getWalletConnect(): WalletConnectService {
  return instance;
}
