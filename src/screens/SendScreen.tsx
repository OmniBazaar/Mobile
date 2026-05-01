/**
 * SendScreen — multi-asset EVM token sender.
 *
 * Lets the user pick a chain + asset (native gas token or any ERC-20
 * the validator knows about), enter a recipient (0x address OR
 * OmniBazaar username), and review the gas-fee estimate before
 * broadcasting.
 *
 * Asset list comes from `PortfolioService.ERC20_TOKENS` plus a
 * synthetic native entry per chain. Username resolution happens via
 * `UsernameResolver.resolveAddress`. Gas estimate via `GasEstimator`.
 * QR scanner via `QRScannerModal`.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Input from '@components/Input';
import ScreenHeader from '@components/ScreenHeader';
import LoadingSpinner from '@components/LoadingSpinner';
import QRScannerModal from '@components/QRScannerModal';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@theme/colors';
import { parseAmount, sendErc20, sendNative, type SendResult } from '../services/SendService';
import { ERC20_TOKENS } from '../services/PortfolioService';
import { resolveAddress, isAddress } from '../services/UsernameResolver';
import { estimateGasFee, type GasEstimate } from '../services/GasEstimator';
import { useScreenCaptureBlocked } from '../services/ScreenCaptureGuard';
import * as haptics from '../utils/haptics';

/** Asset (native or ERC-20) the user can send. */
interface SendAsset {
  chainId: number;
  chainName: string;
  /** Display symbol. */
  symbol: string;
  /** Decimals. */
  decimals: number;
  /**
   * ERC-20 contract address. `undefined` means the native gas
   * currency for the chain.
   */
  contractAddress?: string;
}

/** Pretty-name for a chain ID — shared with PortfolioService. */
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  56: 'BNB Chain',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum',
  43114: 'Avalanche',
  88008: 'OmniCoin',
};

/** Native currency per chain. OmniCoin gas is gasless / sponsored. */
const NATIVE_BY_CHAIN: Array<{
  chainId: number;
  symbol: string;
  decimals: number;
}> = [
  { chainId: 1, symbol: 'ETH', decimals: 18 },
  { chainId: 10, symbol: 'ETH', decimals: 18 },
  { chainId: 137, symbol: 'MATIC', decimals: 18 },
  { chainId: 8453, symbol: 'ETH', decimals: 18 },
  { chainId: 42161, symbol: 'ETH', decimals: 18 },
  { chainId: 43114, symbol: 'AVAX', decimals: 18 },
  { chainId: 56, symbol: 'BNB', decimals: 18 },
];

/** Build the full asset list (XOM ERC-20 + USDC/USDT + native gas tokens). */
function allAssets(): SendAsset[] {
  const assets: SendAsset[] = ERC20_TOKENS.map((tok) => ({
    chainId: tok.chainId,
    chainName: CHAIN_NAMES[tok.chainId] ?? `Chain ${tok.chainId}`,
    symbol: tok.symbol,
    decimals: tok.decimals,
    contractAddress: tok.address,
  }));
  for (const n of NATIVE_BY_CHAIN) {
    assets.push({
      chainId: n.chainId,
      chainName: CHAIN_NAMES[n.chainId] ?? `Chain ${n.chainId}`,
      symbol: n.symbol,
      decimals: n.decimals,
    });
  }
  return assets;
}

/** Props accepted by SendScreen. */
export interface SendScreenProps {
  /** Decrypted BIP39 mnemonic (held briefly in memory). */
  mnemonic: string;
  /** Back-navigation callback. */
  onBack: () => void;
  /** Fired after a successful broadcast with the tx hash. */
  onSent: (result: SendResult) => void;
}

/**
 * Render the multi-asset send form.
 *
 * @param props - See {@link SendScreenProps}.
 * @returns JSX.
 */
export default function SendScreen(props: SendScreenProps): JSX.Element {
  const { t } = useTranslation();
  // Block screenshots — Send shows recipient + amount + balances, all
  // sensitive enough that we shouldn't leak them to remote-display.
  useScreenCaptureBlocked('send');
  const ASSETS = useMemo(() => allAssets(), []);
  // ASSETS is guaranteed non-empty by `allAssets()` (it always returns
  // at least the OmniCoin XOM row); the optional-chaining + fallback
  // is a defensive guard for edge cases. Address is sourced from
  // OMNICOIN_ADDRESSES via PortfolioService — never hardcoded.
  const [asset, setAsset] = useState<SendAsset>(
    ASSETS[0] ?? ({
      chainId: 88008,
      chainName: 'OmniCoin',
      symbol: 'XOM',
      decimals: 18,
      contractAddress: ERC20_TOKENS.find((t) => t.chainId === 88008 && t.symbol === 'XOM')?.address ?? '',
    } as SendAsset),
  );
  const [to, setTo] = useState('');
  const [resolvedTo, setResolvedTo] = useState<string | undefined>(undefined);
  const [resolveError, setResolveError] = useState<string | undefined>(undefined);
  const [resolving, setResolving] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [gas, setGas] = useState<GasEstimate | undefined>(undefined);

  // Resolve recipient (debounced) — accepts 0x address OR username.
  useEffect(() => {
    const trimmed = to.trim();
    if (trimmed === '') {
      setResolvedTo(undefined);
      setResolveError(undefined);
      return;
    }
    if (isAddress(trimmed)) {
      setResolvedTo(trimmed);
      setResolveError(undefined);
      return;
    }
    let cancelled = false;
    setResolving(true);
    setResolveError(undefined);
    const handle = setTimeout(() => {
      void (async (): Promise<void> => {
        try {
          const result = await resolveAddress(trimmed);
          if (cancelled) return;
          setResolvedTo(result.address);
        } catch (err) {
          if (cancelled) return;
          setResolvedTo(undefined);
          setResolveError(
            err instanceof Error ? err.message : String(err),
          );
        } finally {
          if (!cancelled) setResolving(false);
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [to]);

  // Refresh gas estimate when chain or asset kind changes.
  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const est = await estimateGasFee(
          asset.chainId,
          asset.contractAddress === undefined ? 'native' : 'erc20',
        );
        if (!cancelled) setGas(est);
      } catch {
        if (!cancelled) setGas(undefined);
      }
    })();
    return () => { cancelled = true; };
  }, [asset]);

  const amountError = useMemo(() => {
    if (amount === '') return undefined;
    if (!/^\d+(\.\d+)?$/.test(amount.trim())) {
      return t('send.error.invalidAmount', { defaultValue: 'Enter a valid decimal amount.' });
    }
    if (Number.parseFloat(amount) <= 0) {
      return t('send.error.zeroAmount', { defaultValue: 'Amount must be greater than zero.' });
    }
    return undefined;
  }, [amount, t]);

  const canSubmit =
    resolvedTo !== undefined &&
    amount !== '' &&
    amountError === undefined &&
    !busy &&
    !resolving;

  const handleSend = useCallback((): void => {
    if (!canSubmit || resolvedTo === undefined) return;
    Alert.alert(
      t('send.confirm.title', { defaultValue: 'Confirm Send' }),
      t('send.confirm.body', {
        defaultValue: 'Send {{amount}} {{symbol}} on {{chain}} to {{to}}?',
        amount,
        symbol: asset.symbol,
        chain: asset.chainName,
        to: `${resolvedTo.slice(0, 6)}…${resolvedTo.slice(-4)}`,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('send.confirm.send', { defaultValue: 'Send' }),
          style: 'default',
          onPress: () => {
            void (async () => {
              haptics.impactMedium();
              setBusy(true);
              setError(undefined);
              try {
                const parsed = parseAmount(amount, asset.decimals);
                const result =
                  asset.contractAddress === undefined
                    ? await sendNative({
                        mnemonic: props.mnemonic,
                        chainId: asset.chainId,
                        to: resolvedTo,
                        amount: parsed,
                      })
                    : await sendErc20({
                        mnemonic: props.mnemonic,
                        chainId: asset.chainId,
                        tokenAddress: asset.contractAddress,
                        to: resolvedTo,
                        amount: parsed,
                      });
                haptics.success();
                props.onSent(result);
              } catch (err) {
                haptics.error();
                setError(err instanceof Error ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }, [canSubmit, resolvedTo, amount, asset, props, t]);

  if (busy) {
    return (
      <View style={styles.root}>
        <LoadingSpinner
          label={t('send.broadcasting', { defaultValue: 'Broadcasting transaction…' })}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('send.title', { defaultValue: 'Send' })}
        onBack={props.onBack}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.fieldLabel}>{t('send.asset', { defaultValue: 'Asset' })}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chainGrid}>
          {ASSETS.map((a) => {
            const k = `${a.chainId}-${a.contractAddress ?? 'native'}`;
            const selected =
              a.chainId === asset.chainId &&
              (a.contractAddress ?? 'native') === (asset.contractAddress ?? 'native');
            return (
              <Pressable
                key={k}
                onPress={() => setAsset(a)}
                style={[styles.chainChip, selected && styles.chainChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chainChipText, selected && styles.chainChipTextActive]}>
                  {a.symbol} · {a.chainName}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.toRow}>
          <View style={{ flex: 1 }}>
            <Input
              label={t('send.to', { defaultValue: 'Recipient (address or username)' })}
              value={to}
              onChangeText={setTo}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t('send.toPlaceholder', { defaultValue: '0x… or @alice' })}
              error={resolveError}
            />
          </View>
          <Pressable
            onPress={() => setScannerOpen(true)}
            style={styles.scanButton}
            accessibilityRole="button"
            accessibilityLabel={t('send.scanQr', { defaultValue: 'Scan QR' })}
          >
            <Ionicons name="qr-code-outline" size={28} color={colors.primary} />
          </Pressable>
        </View>

        {resolving && (
          <Text style={styles.helper}>
            {t('send.resolving', { defaultValue: 'Looking up username…' })}
          </Text>
        )}
        {resolvedTo !== undefined && !isAddress(to.trim()) && (
          <Text style={styles.helper}>
            {t('send.resolvedTo', {
              defaultValue: '→ {{addr}}',
              addr: `${resolvedTo.slice(0, 6)}…${resolvedTo.slice(-4)}`,
            })}
          </Text>
        )}

        <Input
          label={t('send.amount', { defaultValue: 'Amount' })}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.0"
          error={amountError}
        />

        {gas !== undefined && (
          <View style={styles.gasBox}>
            <Text style={styles.gasLabel}>
              {t('send.gas', { defaultValue: 'Estimated network fee' })}
            </Text>
            <Text style={styles.gasValue}>
              {gas.gasless
                ? t('send.gasless', { defaultValue: 'Free (sponsored by OmniRelay)' })
                : gas.feeUsd !== undefined
                  ? `~$${gas.feeUsd.toFixed(4)} (${gas.nativeSymbol})`
                  : t('send.gasUnavailable', { defaultValue: 'Estimate unavailable — fee paid in {{sym}}', sym: gas.nativeSymbol })}
            </Text>
          </View>
        )}

        {error !== undefined && <Text style={styles.error}>{error}</Text>}

        <View style={styles.actions}>
          <Button
            title={t('send.cta.review', { defaultValue: 'Review & Send' })}
            onPress={handleSend}
            disabled={!canSubmit}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>

      <QRScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(data: string) => {
          // Strip common prefixes (`ethereum:`, `omnibazaar:`) that QR
          // payloads sometimes include — keep just the address/username.
          const stripped = data.replace(/^(?:ethereum|omnibazaar|wallet):/i, '').trim();
          setTo(stripped);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  fieldLabel: { color: colors.textSecondary, fontSize: 13, marginTop: 8, marginBottom: 8 },
  chainGrid: { flexDirection: 'row', marginBottom: 12 },
  chainChip: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chainChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chainChipText: { color: colors.textSecondary, fontSize: 13 },
  chainChipTextActive: { color: colors.background, fontWeight: '600' },
  toRow: { flexDirection: 'row', alignItems: 'flex-end' },
  scanButton: { padding: 12, marginLeft: 8, marginBottom: 4 },
  helper: { color: colors.textSecondary, fontSize: 12, marginBottom: 8 },
  gasBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
  },
  gasLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 4 },
  gasValue: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 14, marginTop: 8 },
  actions: { marginTop: 24 },
  actionButton: { marginBottom: 12 },
});
