/**
 * SwapScreen — intent-based swap entry.
 *
 * Phase 3 scope: quote + route attribution display. Executes the
 * resulting unsigned tx via the SendService path for same-chain
 * same-token transfers; full cross-chain execution (CCTP / Wormhole /
 * ICTT) lands after the OmniRelay + bridge monitor wiring in Phase 3
 * Week 2.
 *
 * What's demonstrated already:
 *   - Pair selector (from / to tokens, each bound to a chain)
 *   - Amount input with live validation
 *   - Quote fetch via UniversalSwapClient
 *   - Route-attribution label (OmniDEX / Li.Fi / 0x)
 *   - Price-impact and min-out display
 *   - Intent classification hint (same-chain vs bridge-only vs bridge+swap)
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Button from '@components/Button';
import Card from '@components/Card';
import Input from '@components/Input';
import LoadingSpinner from '@components/LoadingSpinner';
import ScreenHeader from '@components/ScreenHeader';
import WalletConnectBar, {
  type SwapWalletMode,
} from '@components/WalletConnectBar';
import { colors } from '@theme/colors';

import {
  attributionLabel,
  classifySwap,
  COMMON_TOKENS,
  executeQuote,
  formatPriceImpact,
  getQuote,
  requiresEmbeddedWallet,
  type ExecuteSwapResult,
  type QuoteResponse,
  type SwapQuote,
  type TokenShortcut,
} from '../services/SwapService';
import type { WalletConnectConnection } from '../services/WalletConnectService';
import { useAuthStore } from '../store/authStore';

/** Props accepted by SwapScreen. */
export interface SwapScreenProps {
  /** Back-navigation callback. */
  onBack: () => void;
  /** Navigate to the privacy (pXOM) screen. */
  onOpenPrivacy: () => void;
  /** Navigate to the limit-order screen. */
  onOpenLimit?: () => void;
  /** Navigate to the liquidity-pool screen. */
  onOpenLiquidity?: () => void;
  /** Navigate to the yield-vaults screen. */
  onOpenYield?: () => void;
  /**
   * Decrypted BIP39 mnemonic. Used only during swap execution and
   * kept in memory for the duration of the user's session. Phase 3
   * Week 3 moves this behind EncryptionService.
   */
  mnemonic: string;
}

/**
 * Render the swap entry form.
 * @param props - See {@link SwapScreenProps}.
 * @returns JSX.
 */
export default function SwapScreen(props: SwapScreenProps): JSX.Element {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);

  const [from, setFrom] = useState<TokenShortcut>(COMMON_TOKENS[0]!);
  const [to, setTo] = useState<TokenShortcut>(COMMON_TOKENS[2]!);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [quote, setQuote] = useState<SwapQuote | undefined>(undefined);
  const [quoteResponse, setQuoteResponse] = useState<QuoteResponse | undefined>(
    undefined,
  );
  const [executionResult, setExecutionResult] = useState<
    ExecuteSwapResult | undefined
  >(undefined);
  const [walletMode, setWalletMode] = useState<SwapWalletMode>('embedded');
  const [wcConnection, setWcConnection] =
    useState<WalletConnectConnection | null>(null);

  /** Address used for quotes + execute auth — depends on wallet mode. */
  const activeAddress =
    walletMode === 'walletconnect' && wcConnection !== null
      ? wcConnection.address
      : address;

  /** True when the selected quote needs the embedded mnemonic (XOM leg). */
  const quoteNeedsEmbedded =
    quote !== undefined &&
    walletMode === 'walletconnect' &&
    requiresEmbeddedWallet(quote);

  const amountError = useMemo(() => {
    if (amount === '') return undefined;
    if (!/^\d+(\.\d+)?$/.test(amount.trim())) {
      return t('swap.error.invalidAmount', {
        defaultValue: 'Enter a valid decimal amount.',
      });
    }
    if (Number.parseFloat(amount) <= 0) {
      return t('swap.error.zeroAmount', {
        defaultValue: 'Amount must be positive.',
      });
    }
    return undefined;
  }, [amount, t]);

  const classification = useMemo(
    () =>
      classifySwap({
        sourceChainId: from.chainId,
        targetChainId: to.chainId,
        tokenInSymbol: from.symbol,
        tokenOutSymbol: to.symbol,
      }),
    [from, to],
  );

  const canQuote =
    amount !== '' && amountError === undefined && activeAddress !== '' && !busy;

  const handleQuote = useCallback(async (): Promise<void> => {
    if (!canQuote) return;
    setBusy(true);
    setError(undefined);
    setQuote(undefined);
    try {
      const response = await getQuote({
        tokenIn: from.address,
        tokenInSymbol: from.symbol,
        sourceChainId: from.chainId,
        tokenOut: to.address,
        tokenOutSymbol: to.symbol,
        targetChainId: to.chainId,
        amountIn: amount,
        walletAddress: activeAddress,
        maxSlippageBps: 50,
      });
      setQuoteResponse(response);
      setQuote(response.quotes[0]);
      if (response.quotes.length === 0) {
        setError(
          t('swap.error.noQuotes', {
            defaultValue: 'No route found for this pair.',
          }),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [canQuote, from, to, amount, activeAddress, t]);

  const handleExecute = useCallback(async (): Promise<void> => {
    if (quote === undefined || activeAddress === '') return;
    if (walletMode === 'embedded' && props.mnemonic === '') return;
    if (walletMode === 'walletconnect' && wcConnection === null) return;
    if (walletMode === 'walletconnect' && quoteNeedsEmbedded) {
      setError(
        t('swap.external.requiresEmbedded', {
          defaultValue:
            'This route uses OmniCoin and must be signed by the embedded wallet. Switch to OmniWallet for OmniCoin swaps.',
        }),
      );
      return;
    }
    setExecuting(true);
    setError(undefined);
    setExecutionResult(undefined);
    try {
      const result = await executeQuote({
        quoteId: quote.quoteId,
        address: activeAddress,
        signer:
          walletMode === 'walletconnect'
            ? { kind: 'walletconnect' }
            : { kind: 'embedded', mnemonic: props.mnemonic },
      });
      setExecutionResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExecuting(false);
    }
  }, [
    quote,
    activeAddress,
    walletMode,
    wcConnection,
    quoteNeedsEmbedded,
    props.mnemonic,
    t,
  ]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('swap.title', { defaultValue: 'Swap' })}
        onBack={props.onBack}
      />
      <WalletConnectBar
        walletMode={walletMode}
        onWalletModeChange={setWalletMode}
        onConnectionChange={setWcConnection}
      />

      <View style={styles.headerRow}>
        {props.onOpenLimit !== undefined && (
          <Pressable onPress={props.onOpenLimit} style={styles.privacyLink}>
            <Text style={styles.privacyLinkText}>
              {t('swap.limitLink', { defaultValue: 'Limit' })}
            </Text>
          </Pressable>
        )}
        {props.onOpenLiquidity !== undefined && (
          <Pressable onPress={props.onOpenLiquidity} style={styles.privacyLink}>
            <Text style={styles.privacyLinkText}>
              {t('swap.lpLink', { defaultValue: 'LP' })}
            </Text>
          </Pressable>
        )}
        {props.onOpenYield !== undefined && (
          <Pressable onPress={props.onOpenYield} style={styles.privacyLink}>
            <Text style={styles.privacyLinkText}>
              {t('swap.yieldLink', { defaultValue: 'Yield' })}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={props.onOpenPrivacy}
          accessibilityRole="link"
          style={styles.privacyLink}
        >
          <Text style={styles.privacyLinkText}>
            {t('swap.privacyLink', { defaultValue: 'Privacy (pXOM)' })}
          </Text>
        </Pressable>
      </View>

      <Card style={styles.pairCard}>
        <Text style={styles.fieldLabel}>
          {t('swap.from', { defaultValue: 'From' })}
        </Text>
        <TokenPicker selected={from} onSelect={setFrom} />

        <View style={styles.arrowRow}>
          <Pressable
            onPress={() => {
              const next = from;
              setFrom(to);
              setTo(next);
              setQuote(undefined);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('swap.flip', {
              defaultValue: 'Flip from and to',
            })}
            style={styles.flipButton}
          >
            <Text style={styles.flipText}>⇅</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>
          {t('swap.to', { defaultValue: 'To' })}
        </Text>
        <TokenPicker selected={to} onSelect={setTo} />
      </Card>

      <Input
        label={t('swap.amount', {
          defaultValue: 'Amount ({{symbol}})',
          symbol: from.symbol,
        })}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.0"
        error={amountError}
      />

      <Text style={styles.classification}>
        {classification === 'same-chain-swap'
          ? t('swap.classification.sameChain', {
              defaultValue: 'Same-chain swap',
            })
          : classification === 'bridge-only'
            ? t('swap.classification.bridgeOnly', {
                defaultValue: 'Cross-chain bridge',
              })
            : t('swap.classification.bridgeAndSwap', {
                defaultValue: 'Cross-chain bridge + swap',
              })}
      </Text>

      {quote !== undefined && (
        <Card style={styles.quoteCard}>
          <View style={styles.quoteRow}>
            <Text style={styles.quoteLabel}>
              {t('swap.quote.you_get', { defaultValue: 'You receive' })}
            </Text>
            <Text style={styles.quoteValue}>
              {quote.amountOut} {to.symbol}
            </Text>
          </View>
          <View style={styles.quoteRow}>
            <Text style={styles.quoteLabel}>
              {t('swap.quote.min', { defaultValue: 'Minimum after slippage' })}
            </Text>
            <Text style={styles.quoteValueMuted}>
              {quote.amountOutMin} {to.symbol}
            </Text>
          </View>
          <View style={styles.quoteRow}>
            <Text style={styles.quoteLabel}>
              {t('swap.quote.impact', { defaultValue: 'Price impact' })}
            </Text>
            <Text style={styles.quoteValueMuted}>
              {formatPriceImpact(quote.priceImpactBps)}
            </Text>
          </View>
          <View style={styles.quoteRow}>
            <Text style={styles.quoteLabel}>
              {t('swap.quote.route', { defaultValue: 'Route' })}
            </Text>
            <Text style={styles.attribution}>{attributionLabel(quote)}</Text>
          </View>
          {quoteResponse !== undefined && quoteResponse.quotes.length > 1 && (
            <Text style={styles.alternativesHint}>
              {t('swap.quote.alternatives', {
                defaultValue: '{{n}} alternative route{{s}} available',
                n: quoteResponse.quotes.length - 1,
                s: quoteResponse.quotes.length === 2 ? '' : 's',
              })}
            </Text>
          )}
        </Card>
      )}

      {error !== undefined && <Text style={styles.error}>{error}</Text>}

      {busy ? (
        <LoadingSpinner
          label={t('swap.quoting', { defaultValue: 'Fetching best route…' })}
        />
      ) : (
        <View style={styles.actions}>
          <Button
            title={
              quote === undefined
                ? t('swap.cta.getQuote', { defaultValue: 'Get Quote' })
                : t('swap.cta.refreshQuote', { defaultValue: 'Refresh Quote' })
            }
            onPress={() => void handleQuote()}
            disabled={!canQuote}
            style={styles.actionButton}
          />
          {quote !== undefined && executionResult === undefined && (
            <>
              {quoteNeedsEmbedded && (
                <Text style={styles.warning}>
                  {t('swap.external.requiresEmbedded', {
                    defaultValue:
                      'This route uses OmniCoin and must be signed by the embedded wallet. Switch to OmniWallet for OmniCoin swaps.',
                  })}
                </Text>
              )}
              <Button
                title={
                  executing
                    ? walletMode === 'walletconnect'
                      ? t('swap.cta.confirmInWallet', {
                          defaultValue: 'Confirm in your wallet…',
                        })
                      : t('swap.cta.executing', {
                          defaultValue: 'Signing & broadcasting…',
                        })
                    : t('swap.cta.execute', { defaultValue: 'Swap Now' })
                }
                onPress={() => void handleExecute()}
                disabled={
                  executing ||
                  quoteNeedsEmbedded ||
                  (walletMode === 'embedded' && props.mnemonic === '') ||
                  (walletMode === 'walletconnect' && wcConnection === null)
                }
                style={styles.actionButton}
              />
            </>
          )}
          {executionResult !== undefined && (
            <View
              style={styles.successBox}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              <Text style={styles.successTitle}>
                {t('swap.success.title', { defaultValue: 'Submitted ✓' })}
              </Text>
              <Text style={styles.successBody}>
                {t('swap.success.body', {
                  defaultValue: 'Operation {{op}} — status: {{status}}',
                  op: executionResult.operationId.slice(0, 10),
                  status: executionResult.status,
                })}
              </Text>
              {executionResult.txHashes.map((hash, i) => (
                <Text key={hash} style={styles.successTx}>
                  tx{i + 1} · chain {executionResult.chainIds[i] ?? '?'} ·{' '}
                  {hash.slice(0, 10)}…{hash.slice(-6)}
                </Text>
              ))}
            </View>
          )}
          <Button
            title={t('common.back', { defaultValue: 'Back' })}
            onPress={props.onBack}
            variant="secondary"
          />
        </View>
      )}
    </View>
  );
}

/** Inline token picker — chip row across COMMON_TOKENS. */
function TokenPicker({
  selected,
  onSelect,
}: {
  selected: TokenShortcut;
  onSelect: (token: TokenShortcut) => void;
}): JSX.Element {
  return (
    <View style={styles.tokenRow}>
      {COMMON_TOKENS.map((tok) => {
        const active =
          tok.chainId === selected.chainId &&
          tok.address === selected.address &&
          tok.symbol === selected.symbol;
        return (
          <Pressable
            key={`${tok.chainId}-${tok.symbol}-${tok.address}`}
            onPress={() => onSelect(tok)}
            style={[styles.tokenChip, active && styles.tokenChipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.tokenChipText,
                active && styles.tokenChipTextActive,
              ]}
            >
              {tok.symbol}
              <Text style={styles.tokenChipSub}>
                {' '}
                · {shortChain(tok.chainId)}
              </Text>
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Short chain label for token chips. */
function shortChain(chainId: number): string {
  switch (chainId) {
    case 1:
      return 'ETH';
    case 10:
      return 'OP';
    case 56:
      return 'BSC';
    case 137:
      return 'POLY';
    case 8453:
      return 'BASE';
    case 42161:
      return 'ARB';
    case 43114:
      return 'AVAX';
    case 88008:
      return 'XOM-L1';
    default:
      return `#${chainId}`;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 32,
  },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '700' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  privacyLink: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  privacyLinkText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  pairCard: { marginBottom: 16 },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  tokenRow: { flexDirection: 'row', flexWrap: 'wrap' },
  tokenChip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  tokenChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tokenChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  tokenChipTextActive: { color: colors.background, fontWeight: '700' },
  tokenChipSub: { color: colors.textMuted, fontSize: 11 },
  arrowRow: { alignItems: 'center', marginVertical: 8 },
  flipButton: { padding: 8 },
  flipText: { color: colors.primary, fontSize: 20 },
  classification: { color: colors.textMuted, fontSize: 12, marginBottom: 16 },
  quoteCard: { marginBottom: 16 },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  quoteLabel: { color: colors.textSecondary, fontSize: 13 },
  quoteValue: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  quoteValueMuted: { color: colors.textPrimary, fontSize: 13 },
  attribution: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  alternativesHint: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  error: { color: colors.danger, fontSize: 14, marginBottom: 12 },
  warning: {
    color: colors.warning,
    fontSize: 13,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  actions: { marginTop: 'auto' },
  actionButton: { marginBottom: 12 },
  successBox: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.success,
    marginTop: 8,
  },
  successTitle: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  successBody: { color: colors.textPrimary, fontSize: 13, marginBottom: 6 },
  successTx: { color: colors.textMuted, fontSize: 11, fontFamily: 'monospace' },
});
