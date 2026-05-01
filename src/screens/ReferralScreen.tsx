/**
 * ReferralScreen — share your referral link + QR.
 *
 * Each user's referral URL is `https://omnibazaar.com/?ref=<username>`.
 * The screen renders a tappable QR code, copy + share buttons, and
 * shows the user's accumulated referral count + earned XOM (read from
 * `/api/v1/referrals/:address`). Real fees: 70/20/10 split among
 * referrer / second-level / ODDAO per CLAUDE.md.
 *
 * @module screens/ReferralScreen
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '@components/ScreenHeader';
import { colors } from '@theme/colors';
import { useAuthStore } from '../store/authStore';
import { getBaseUrl } from '../services/BootstrapService';
import { logger } from '../utils/logger';

interface ReferralStats {
  count?: number;
  earnedXom?: string;
}

/** Build the canonical referral URL for the signed-in user. */
function referralUrl(username: string): string {
  return `https://omnibazaar.com/?ref=${encodeURIComponent(username)}`;
}

/** Props accepted by ReferralScreen. */
export interface ReferralScreenProps {
  onBack: () => void;
}

/**
 * Render the referral hub.
 *
 * @param props - See {@link ReferralScreenProps}.
 * @returns JSX.
 */
export default function ReferralScreen(
  props: ReferralScreenProps,
): React.ReactElement {
  const { t } = useTranslation();
  const username = useAuthStore((s) => s.username);
  const address = useAuthStore((s) => s.address);
  const [stats, setStats] = useState<ReferralStats | undefined>(undefined);

  const url = username !== '' ? referralUrl(username) : '';

  useEffect(() => {
    if (address === '') return;
    void (async () => {
      try {
        const r = await fetch(
          `${getBaseUrl().replace(/\/+$/, '')}/api/v1/referrals/${encodeURIComponent(address)}`,
          { signal: AbortSignal.timeout(8_000) },
        );
        if (!r.ok) return;
        const body = (await r.json()) as { data?: ReferralStats } & ReferralStats;
        setStats(body.data ?? body);
      } catch (err) {
        logger.debug('[referrals] stats fetch failed', {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }, [address]);

  const onCopy = useCallback(async (): Promise<void> => {
    if (url === '') return;
    await Clipboard.setStringAsync(url);
    Alert.alert(
      t('referral.copied', { defaultValue: 'Link copied!' }),
      url,
    );
  }, [url, t]);

  const onShare = useCallback(async (): Promise<void> => {
    if (url === '') return;
    await Share.share({
      message: t('referral.shareMessage', {
        defaultValue: 'Join me on OmniBazaar — the decentralized marketplace. {{url}}',
        url,
      }),
      url,
      title: t('referral.shareTitle', { defaultValue: 'Refer a friend to OmniBazaar' }),
    });
  }, [url, t]);

  if (username === '') {
    return (
      <View style={styles.root}>
        <ScreenHeader
          title={t('referral.title', { defaultValue: 'Refer a Friend' })}
          onBack={props.onBack}
        />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {t('referral.needUsername', {
              defaultValue: 'Pick a username before sharing your referral link.',
            })}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('referral.title', { defaultValue: 'Refer a Friend' })}
        onBack={props.onBack}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.intro}>
          {t('referral.intro', {
            defaultValue:
              'Share OmniBazaar. You earn 0.35% of every fee from your referrals — paid in XOM, gasless on L1.',
          })}
        </Text>

        <View style={styles.qrCard}>
          <QRCode
            value={url}
            size={220}
            backgroundColor={colors.surface}
            color={colors.textPrimary}
          />
          <Text style={styles.url} selectable numberOfLines={2}>
            {url}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={(): void => void onCopy()}
            accessibilityRole="button"
            accessibilityLabel={t('referral.copy', { defaultValue: 'Copy link' })}
            style={styles.actionButton}
          >
            <Ionicons name="copy-outline" size={20} color={colors.primary} />
            <Text style={styles.actionText}>{t('referral.copy', { defaultValue: 'Copy' })}</Text>
          </Pressable>
          <Pressable
            onPress={(): void => void onShare()}
            accessibilityRole="button"
            accessibilityLabel={t('referral.share', { defaultValue: 'Share link' })}
            style={styles.actionButton}
          >
            <Ionicons name="share-outline" size={20} color={colors.primary} />
            <Text style={styles.actionText}>{t('referral.share', { defaultValue: 'Share' })}</Text>
          </Pressable>
        </View>

        {stats !== undefined && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.count ?? 0}</Text>
              <Text style={styles.statLabel}>
                {t('referral.referredCount', { defaultValue: 'Referred users' })}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.earnedXom ?? '0'}</Text>
              <Text style={styles.statLabel}>
                {t('referral.earned', { defaultValue: 'Earned (XOM)' })}
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.disclaimer}>
          {t('referral.disclaimer', {
            defaultValue:
              'Each invite is permanent (cookie-tracked) and pays you while your referrals stay active.',
          })}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { padding: 16, paddingBottom: 48 },
  intro: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 24 },
  qrCard: { alignItems: 'center', backgroundColor: colors.surface, padding: 24, borderRadius: 16 },
  url: { color: colors.primary, fontSize: 13, marginTop: 16, textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 24 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  actionText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: { color: colors.primary, fontSize: 24, fontWeight: '700' },
  statLabel: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyText: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  disclaimer: { color: colors.textMuted, fontSize: 12, marginTop: 24, textAlign: 'center', lineHeight: 18 },
});
