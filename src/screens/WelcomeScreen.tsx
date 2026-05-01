/**
 * WelcomeScreen — first screen a user sees on cold start of a device
 * that has no wallet yet.
 *
 * Three-swipe intro:
 *   1. Decentralized marketplace — 5 marketplaces + millions of listings
 *   2. Gasless on OmniCoin L1 — zero gas via OmniRelay
 *   3. Your keys, your control — trustless, client-side BIP39
 *
 * Primary action is Create Wallet; secondary is Import Wallet. A "Sign
 * In" link at the bottom covers the case where a user on a new device
 * wants to recover an already-registered username (same import flow,
 * different post-PIN branch).
 */

import React, { useCallback, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import { colors } from '@theme/colors';

/** Navigation prop shape the screen expects. */
export interface WelcomeScreenProps {
  /** Called when the user taps "Create Account". */
  onCreateWallet: () => void;
  /** Called when the user taps "Log In" (existing account on this or any device). */
  onSignIn: () => void;
}

interface Slide {
  /** i18n key prefix for title + description. */
  key: string;
  /** Fallback English title (if i18n key missing). */
  titleFallback: string;
  /** Fallback English description (if i18n key missing). */
  bodyFallback: string;
}

const SLIDES: Slide[] = [
  {
    key: 'welcome.slide.marketplace',
    titleFallback: 'A marketplace that belongs to you.',
    bodyFallback:
      'Buy, sell, and trade across 5 marketplaces. No gatekeepers, no middlemen, no surprise fees.',
  },
  {
    key: 'welcome.slide.gasless',
    titleFallback: 'Zero gas on OmniCoin.',
    bodyFallback:
      'Every transaction on OmniCoin L1 is sponsored. List, swap, stake, and trade without holding gas.',
  },
  {
    key: 'welcome.slide.trustless',
    titleFallback: 'Your keys, your wallet.',
    bodyFallback:
      'Your seed phrase never leaves this device. Sign in with your signature, not a password.',
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Render the welcome onboarding carousel.
 *
 * @param props - See {@link WelcomeScreenProps}.
 * @returns JSX.
 */
export default function WelcomeScreen(props: WelcomeScreenProps): JSX.Element {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
      const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      if (next !== page) setPage(next);
    },
    [page],
  );

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.carousel}
      >
        {SLIDES.map((slide) => (
          <View key={slide.key} style={styles.slide}>
            <View style={styles.slideInner}>
              <Text style={styles.slideTitle} accessibilityRole="header">
                {t(`${slide.key}.title`, { defaultValue: slide.titleFallback })}
              </Text>
              <Text style={styles.slideBody}>
                {t(`${slide.key}.body`, { defaultValue: slide.bodyFallback })}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((slide, i) => (
          <View
            key={slide.key}
            style={[styles.dot, i === page && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <Button
          title={t('welcome.cta.create', { defaultValue: 'Create New Account' })}
          onPress={props.onCreateWallet}
          variant="primary"
          style={styles.actionButton}
        />
        <Button
          title={t('welcome.cta.signIn', { defaultValue: 'Log In' })}
          onPress={props.onSignIn}
          variant="secondary"
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  carousel: { flex: 1 },
  slide: { width: SCREEN_WIDTH, paddingHorizontal: 32, justifyContent: 'center' },
  slideInner: { alignItems: 'center' },
  slideTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  slideBody: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  dotActive: { backgroundColor: colors.primary, width: 24 },
  actions: { paddingHorizontal: 32, paddingBottom: 48 },
  actionButton: { marginBottom: 12 },
  signInRow: {
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 14,
    marginTop: 8,
  },
  signInLink: { color: colors.primary, fontWeight: '600' },
});
