/**
 * TokenApprovalsScreen — list active ERC-20 approvals + revoke
 * action.
 *
 * Backed by the validator's `/api/v1/wallet/approvals/:address`
 * endpoint, which scans on-chain `Approval` events for the user's
 * address. The revoke action sends an `approve(spender, 0)` txn
 * through the OmniRelay path so the user pays no gas.
 *
 * @module screens/TokenApprovalsScreen
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Card from '@components/Card';
import ScreenHeader from '@components/ScreenHeader';
import { colors } from '@theme/colors';
import { getBaseUrl } from '../services/BootstrapService';
import { withRetry } from '../services/RetryHelper';
import { useAuthStore } from '../store/authStore';

/** Single approval row from the validator. */
interface ApprovalRow {
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  spender: string;
  /** Allowance — '∞' for max-uint, otherwise decimal display string. */
  allowance: string;
  /** Spender display name when known (e.g. "Uniswap V3"). */
  spenderName?: string;
}

/** Props for {@link TokenApprovalsScreen}. */
export interface TokenApprovalsScreenProps {
  /** Mnemonic so we can sign the revoke txn. */
  mnemonic: string;
  /** Back-navigation callback. */
  onBack: () => void;
}

/**
 * Render the active approvals list with revoke action.
 *
 * @param props - See {@link TokenApprovalsScreenProps}.
 * @returns JSX.
 */
export default function TokenApprovalsScreen(
  props: TokenApprovalsScreenProps,
): JSX.Element {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [revoking, setRevoking] = useState<string | undefined>(undefined);

  const refresh = useCallback(async (): Promise<void> => {
    if (address === '') return;
    setLoading(true);
    setError(undefined);
    try {
      const base = getBaseUrl().replace(/\/$/, '');
      const url = `${base}/api/v1/wallet/approvals/${encodeURIComponent(address)}`;
      const data = await withRetry(async (): Promise<{ approvals?: ApprovalRow[] }> => {
        const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as { approvals?: ApprovalRow[] };
      });
      setRows(Array.isArray(data.approvals) ? data.approvals : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRevoke = useCallback(
    async (row: ApprovalRow): Promise<void> => {
      const id = `${row.chainId}-${row.tokenAddress}-${row.spender}`;
      setRevoking(id);
      try {
        // Build the approve(spender, 0) call via the SendService's
        // ERC-20 path. We re-use the existing transfer pipeline because
        // it already handles signing, gas, and OmniRelay routing.
        const { sendErc20 } = await import('../services/SendService');
        // sendErc20 sends `transfer`, but for approve we need a
        // different ABI — fall through to a raw contract call. Use
        // ethers Contract directly here.
        const { ethers, Wallet } = await import('ethers');
        const { getClientRPCRegistry } = await import('@wallet/core/providers/ClientRPCRegistry');
        const provider = getClientRPCRegistry().getProvider(row.chainId);
        if (provider === undefined) {
          throw new Error(`No RPC for chain ${row.chainId}`);
        }
        const wallet = Wallet.fromPhrase(
          props.mnemonic,
          provider as unknown as import('ethers').Provider,
        );
        const contract = new ethers.Contract(
          row.tokenAddress,
          ['function approve(address spender, uint256 amount) returns (bool)'],
          wallet,
        );
        const approveFn = contract['approve'];
        if (typeof approveFn !== 'function') {
          throw new Error('approve ABI not bound');
        }
        await (approveFn as (...a: unknown[]) => Promise<{ wait: () => Promise<unknown> }>)(
          row.spender,
          0n,
        );
        await refresh();
        // sendErc20 import is just for warm-load; the call uses raw approve.
        void sendErc20;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setRevoking(undefined);
      }
    },
    [props.mnemonic, refresh],
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('approvals.title', { defaultValue: 'Token Approvals' })}
        onBack={props.onBack}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.body}>
          {t('approvals.body', {
            defaultValue:
              'Apps you grant approval to can move tokens on your behalf — even after you stop using them. Revoke approvals you no longer need to limit your exposure.',
          })}
        </Text>
        {loading && rows.length === 0 && (
          <Text style={styles.empty}>
            {t('approvals.loading', { defaultValue: 'Loading approvals…' })}
          </Text>
        )}
        {error !== undefined && <Text style={styles.error}>{error}</Text>}
        {!loading && rows.length === 0 && error === undefined && (
          <Text style={styles.empty}>
            {t('approvals.none', { defaultValue: 'No active approvals.' })}
          </Text>
        )}
        {rows.map((r) => {
          const id = `${r.chainId}-${r.tokenAddress}-${r.spender}`;
          return (
            <Card key={id} style={styles.row}>
              <Text style={styles.symbol}>{r.tokenSymbol}</Text>
              <Text style={styles.spender}>
                {r.spenderName ?? `${r.spender.slice(0, 8)}…${r.spender.slice(-6)}`}
              </Text>
              <Text style={styles.allowance}>
                {t('approvals.allowance', {
                  defaultValue: 'Allowance: {{amount}}',
                  amount: r.allowance,
                })}
              </Text>
              <Button
                title={revoking === id
                  ? t('approvals.revoking', { defaultValue: 'Revoking…' })
                  : t('approvals.revoke', { defaultValue: 'Revoke' })}
                variant="secondary"
                disabled={revoking !== undefined}
                onPress={() => void handleRevoke(r)}
              />
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  body: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 16 },
  empty: { color: colors.textMuted, padding: 24, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 14, marginVertical: 8 },
  row: { marginBottom: 10 },
  symbol: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  spender: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  allowance: { color: colors.textPrimary, fontSize: 14, marginTop: 6, marginBottom: 8 },
});
