import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet, Modal, Linking, Platform, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Register Mobile platform adapters before any @wallet/* service module
// is imported (those modules call getStorageAdapter() / getNotificationAdapter()
// at use time; see Validator/ADD_MOBILE_APP.md Phase 0 + Wallet/src/platform/).
//
// Wrapped in try/catch so a single misbehaving native module can't crash
// the JS bundle's synchronous bootstrap and bounce the user back to the
// launcher with a white-screen flash. Errors here surface in the
// version-check error banner instead.
import { registerMobileAdapters } from './src/platform/register-mobile-adapters';
import { initSentry } from './src/services/SentryService';
import { initI18n, pickLanguage } from './src/i18n';

const bootErrors: string[] = [];

try {
  registerMobileAdapters();
} catch (err) {
  bootErrors.push(`platform-adapters: ${err instanceof Error ? err.message : String(err)}`);
  // eslint-disable-next-line no-console
  console.warn('[boot] registerMobileAdapters failed:', err);
}

try {
  initSentry();
} catch (err) {
  bootErrors.push(`sentry: ${err instanceof Error ? err.message : String(err)}`);
  // eslint-disable-next-line no-console
  console.warn('[boot] initSentry failed:', err);
}

void (async (): Promise<void> => {
  try {
    await initI18n(pickLanguage([]));
  } catch (err) {
    bootErrors.push(`i18n: ${err instanceof Error ? err.message : String(err)}`);
    // eslint-disable-next-line no-console
    console.warn('[boot] initI18n failed:', err);
  }
})();

import RootNavigator from './src/navigation/RootNavigator';
import { VersionCheckService, type VersionCheckResult, type VersionStatus } from './src/services/VersionCheckService';

/** Store URL for directing users to update the app */
const STORE_URL = Platform.select({
  ios: 'https://apps.apple.com/app/omnibazaar/id000000000',
  android: 'https://play.google.com/store/apps/details?id=com.omnibazaar.app',
  default: 'https://omnibazaar.com/download',
});

/**
 * Root application component with version gate.
 *
 * On mount, queries the validator REST API for version requirements.
 * If a mandatory update is detected, shows a non-dismissible modal.
 * If an optional update is available, shows a dismissible banner.
 * Otherwise renders the placeholder app screen.
 */
export default function App(): JSX.Element {
  const [versionResult, setVersionResult] = useState<VersionCheckResult | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const service = new VersionCheckService();
    let cancelled = false;

    service.check().then((result) => {
      if (!cancelled) setVersionResult(result);
    }).catch(() => {
      /* Graceful degradation — let the app continue */
    });

    return () => { cancelled = true; };
  }, []);

  const status: VersionStatus = versionResult?.status ?? 'unknown';

  /** Open the appropriate app store for the platform */
  const handleUpdate = (): void => {
    void Linking.openURL(STORE_URL);
  };

  return (
    <View style={styles.container}>
      {/* ---- Mandatory update gate ---- */}
      <Modal
        visible={status === 'mandatory-update'}
        animationType="fade"
        transparent
        statusBarTranslucent
        accessible
        accessibilityLabel="Required update available"
        accessibilityViewIsModal
      >
        <View style={styles.overlay}>
          <View style={styles.modal} accessibilityRole="alert">
            <Text style={styles.modalTitle}>Update Required</Text>
            <Text style={styles.modalBody}>
              A required update is available (v{versionResult?.latestVersion ?? '?'}).
              Please update OmniBazaar to continue.
            </Text>
            {versionResult?.minimumVersion !== '' && (
              <Text style={styles.modalDetail}>
                Minimum version: {versionResult?.minimumVersion}
              </Text>
            )}
            <Pressable
              style={styles.updateButton}
              onPress={handleUpdate}
              accessibilityRole="button"
              accessibilityLabel="Update OmniBazaar"
            >
              <Text style={styles.updateButtonText}>Update Now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ---- Optional update banner ---- */}
      {status === 'update-available' && !dismissed && (
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={styles.bannerText}>
            Version {versionResult?.latestVersion ?? '?'} is available.
          </Text>
          <View style={styles.bannerActions}>
            <Pressable
              onPress={handleUpdate}
              style={styles.bannerButton}
              accessibilityRole="button"
              accessibilityLabel="Update OmniBazaar"
            >
              <Text style={styles.bannerButtonText}>Update</Text>
            </Pressable>
            <Pressable
              onPress={() => setDismissed(true)}
              style={styles.bannerDismiss}
              accessibilityRole="button"
              accessibilityLabel="Dismiss update notification"
            >
              <Text style={styles.bannerDismissText}>Later</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ---- App content ---- */}
      <RootNavigator />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1117',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
  },
  /* Modal overlay */
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 15,
    color: '#cccccc',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  modalDetail: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 20,
  },
  updateButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  /* Update banner */
  banner: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    backgroundColor: '#1e3a5f',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  bannerText: {
    color: '#a3cfff',
    fontSize: 14,
    flex: 1,
  },
  bannerActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  bannerButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  bannerButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  bannerDismiss: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  bannerDismissText: {
    color: '#6b93c0',
    fontSize: 13,
  },
});