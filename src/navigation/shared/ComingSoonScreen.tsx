/**
 * Generic placeholder screen for tab routes whose real implementation
 * lands in a later Sprint. Intentionally minimal — shows the feature
 * name + the Sprint that owns it + a pointer to the remediation plan
 * so the user (and future Claude sessions) can see what's missing
 * without digging through code.
 *
 * The placeholder is read-only — there are no buttons that lead
 * elsewhere, because the user already has the tab bar to navigate.
 *
 * @module navigation/shared/ComingSoonScreen
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { colors } from '@theme/colors';

/** Route params for the generic ComingSoon screen. */
export interface ComingSoonRouteParams {
  /** Human-readable feature name. */
  feature: string;
  /** Sprint identifier ("Sprint 2 H5", "Sprint 3", …). */
  sprint?: string;
}

/**
 * Render the placeholder screen.
 *
 * @param props - Route info from react-navigation.
 * @returns JSX.
 */
export function ComingSoonScreen({
  route,
}: {
  route: { params?: ComingSoonRouteParams };
}): React.ReactElement {
  const { t } = useTranslation();
  const nav = useNavigation();
  const params: ComingSoonRouteParams = route.params ?? { feature: 'Feature' };
  const featureLabel = params.feature;
  const sprintLabel = params.sprint ?? 'next release';
  return (
    <View style={styles.root}>
      <Pressable
        onPress={(): void => nav.goBack()}
        accessibilityRole="button"
        accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
        style={styles.back}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
      </Pressable>
      <View style={styles.body}>
        <Ionicons name="construct-outline" size={48} color={colors.primary} />
        <Text style={styles.title}>{featureLabel}</Text>
        <Text style={styles.subtitle}>
          {t('comingSoon.body', {
            defaultValue: 'This screen lands in {{sprint}}. Track progress in MOBILE_REMEDIATION_PLAN.md.',
            sprint: sprintLabel,
          })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingTop: 56, paddingHorizontal: 24 },
  back: { paddingVertical: 8 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 16 },
  subtitle: { color: colors.textSecondary, fontSize: 15, marginTop: 12, textAlign: 'center' },
});
