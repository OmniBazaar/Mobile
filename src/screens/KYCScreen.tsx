/**
 * KYCScreen — Phase 5 KYC tier display + Persona handoff.
 *
 * Renders the 4-tier KYC ladder with the user's current tier highlighted
 * and a Continue button that opens the Persona verification flow in the
 * in-app browser (via the platform TabsAdapter / expo-web-browser).
 * When Persona completes verification it deep-links back into the app
 * and a validator webhook updates the user's tier server-side.
 *
 * Phase 5 MVP: tier display + Persona launch. Reading the user's
 * current tier back from the validator is wired in Phase 5 Week 2 once
 * the KYC-read endpoint integration on the Mobile path lands.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Card from '@components/Card';
import ScreenHeader from '@components/ScreenHeader';
import { colors } from '@theme/colors';
import { getTabsAdapter } from '@wallet/platform/registry';
import { getBaseUrl } from '../services/BootstrapService';
import { fetchKycStatus, invalidateKycCache, type KycStatus } from '../services/KYCStatusService';
import { useAuthStore } from '../store/authStore';

/** KYC tier metadata. */
interface KycTier {
  tier: number;
  name: string;
  requirements: string;
  scoreBoost: number;
}

const TIERS: KycTier[] = [
  { tier: 0, name: 'Anonymous', requirements: 'Email verification', scoreBoost: 0 },
  { tier: 1, name: 'Basic', requirements: 'Email + phone + social follow', scoreBoost: 5 },
  { tier: 2, name: 'Verified', requirements: 'Proof of address + OCR + AML/PEP screening', scoreBoost: 10 },
  { tier: 3, name: 'Identity', requirements: 'Persona gov ID / passport + facial match', scoreBoost: 15 },
  { tier: 4, name: 'Institutional', requirements: 'Persona business entity (validators @ hard launch)', scoreBoost: 20 },
];

/** Props accepted by KYCScreen. */
export interface KYCScreenProps {
  /** Back-navigation callback. */
  onBack: () => void;
}

/**
 * Render the KYC ladder + Persona handoff.
 * @param props - See {@link KYCScreenProps}.
 * @returns JSX.
 */
export default function KYCScreen(props: KYCScreenProps): JSX.Element {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);
  const [status, setStatus] = useState<KycStatus | undefined>(undefined);
  const [launching, setLaunching] = useState(false);
  const currentTier = status?.tier ?? 0;

  // Read current tier from validator on mount + whenever address changes.
  // Soft-fail: tier 0 is the safe default if the network call hangs.
  useEffect(() => {
    if (address === '') return;
    let cancelled = false;
    void (async (): Promise<void> => {
      const s = await fetchKycStatus(address);
      if (!cancelled) setStatus(s);
    })();
    return () => { cancelled = true; };
  }, [address]);

  const handleLaunchPersona = useCallback(async (): Promise<void> => {
    setLaunching(true);
    try {
      const url = `${getBaseUrl()}/api/v1/kyc/persona/start?address=${encodeURIComponent(address)}&returnTo=${encodeURIComponent('omnibazaar://kyc/complete')}`;
      await getTabsAdapter().openUrl(url);
      // Invalidate cache so next read picks up the post-Persona tier.
      invalidateKycCache(address);
    } catch (err) {
      console.warn('[kyc] Persona launch failed', err);
    } finally {
      setLaunching(false);
    }
  }, [address]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('kyc.title', { defaultValue: 'Identity Verification' })}
        onBack={props.onBack}
      />
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          {t('kyc.subtitle', {
            defaultValue:
              'Higher KYC tiers unlock more marketplaces, higher trading limits, and validator eligibility.',
          })}
        </Text>
        <Text style={styles.currentTierLine}>
          {t('kyc.currentTier', {
            defaultValue: 'Current tier: {{name}} (Tier {{n}})',
            name: status?.tierName ?? 'Anonymous',
            n: currentTier,
          })}
        </Text>
      </View>

      {TIERS.map((tier) => {
        const isCurrent = tier.tier === currentTier;
        const isLocked = tier.tier > currentTier + 1;
        return (
          <Card
            key={tier.tier}
            style={[styles.tierCard, isCurrent && styles.tierCardActive]}
          >
            <View style={styles.tierRow}>
              <Text style={[styles.tierNumber, isCurrent && styles.tierNumberActive]}>
                {t('kyc.tier', { defaultValue: 'Tier' })} {tier.tier}
              </Text>
              <Text style={styles.tierName}>{tier.name}</Text>
              {isCurrent && (
                <Text style={styles.currentBadge}>
                  {t('kyc.current', { defaultValue: 'Current' })}
                </Text>
              )}
            </View>
            <Text style={styles.tierRequirements}>{tier.requirements}</Text>
            <Text style={styles.tierScore}>
              {t('kyc.score', { defaultValue: '+{{n}} trust score', n: tier.scoreBoost })}
            </Text>
            {isLocked && (
              <Text style={styles.lockedHint}>
                {t('kyc.locked', {
                  defaultValue: 'Complete the previous tier first.',
                })}
              </Text>
            )}
          </Card>
        );
      })}

      <View style={styles.actions}>
        <Button
          title={
            launching
              ? t('kyc.launching', { defaultValue: 'Opening verification…' })
              : t('kyc.cta.continue', { defaultValue: 'Continue Verification' })
          }
          onPress={() => void handleLaunchPersona()}
          disabled={launching}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingBottom: 32 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  backButton: { paddingVertical: 8 },
  backText: { color: colors.primary, fontSize: 14 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 4 },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 8 },
  currentTierLine: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  tierCard: { marginHorizontal: 16, marginBottom: 10 },
  tierCardActive: { borderWidth: 1, borderColor: colors.primary },
  tierRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  tierNumber: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginRight: 10,
  },
  tierNumberActive: { color: colors.primary },
  tierName: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', flex: 1 },
  currentBadge: {
    color: colors.background,
    backgroundColor: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tierRequirements: { color: colors.textSecondary, fontSize: 13 },
  tierScore: { color: colors.primary, fontSize: 12, marginTop: 6 },
  lockedHint: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  actions: { paddingHorizontal: 16, marginTop: 16 },
});
