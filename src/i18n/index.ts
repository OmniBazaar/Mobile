/**
 * i18next initialization for Mobile.
 *
 * Locale JSON is synced from Wallet via `scripts/sync-i18n.mjs` into
 * `src/i18n/locales/<lang>/`. The active language is chosen from the
 * device locale at cold start and persisted via expo-secure-store on
 * every user change (see SettingsScreen).
 *
 * Default namespace is `translation`; the `wallet-popup` namespace is
 * also loaded when present so keys originally written for the extension
 * popup resolve on Mobile too.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Locale resources. Each import is lazy-evaluated by Metro; bundle size
// stays reasonable because translation.json is ~tens of KB per locale.
import en from './locales/en/translation.json';
import es from './locales/es/translation.json';
import fr from './locales/fr/translation.json';
import de from './locales/de/translation.json';
import it from './locales/it/translation.json';
import pt from './locales/pt/translation.json';
import zh from './locales/zh/translation.json';
import ja from './locales/ja/translation.json';
import ko from './locales/ko/translation.json';
import ru from './locales/ru/translation.json';

/** ISO 639-1 tags for every supported locale. */
export const SUPPORTED_LANGUAGES = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'zh',
  'ja',
  'ko',
  'ru',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Resolve the best language for the user based on a list of candidates.
 * Falls back to English if none are supported.
 *
 * @param candidates - Ordered language preference list (typically from device).
 * @returns Matching supported language tag.
 */
export function pickLanguage(candidates: string[]): SupportedLanguage {
  for (const raw of candidates) {
    const base = raw.split('-')[0]?.toLowerCase();
    if (base !== undefined && SUPPORTED_LANGUAGES.includes(base as SupportedLanguage)) {
      return base as SupportedLanguage;
    }
  }
  return 'en';
}

/**
 * Initialize i18next. Safe to call more than once; subsequent calls
 * no-op through the initialized flag.
 *
 * @param language - Initial language; defaults to `en`.
 */
export async function initI18n(language: SupportedLanguage = 'en'): Promise<void> {
  if (i18n.isInitialized) return;
  await i18n.use(initReactI18next).init({
    lng: language,
    fallbackLng: 'en',
    defaultNS: 'translation',
    ns: ['translation'],
    resources: {
      en: { translation: en as Record<string, unknown> },
      es: { translation: es as Record<string, unknown> },
      fr: { translation: fr as Record<string, unknown> },
      de: { translation: de as Record<string, unknown> },
      it: { translation: it as Record<string, unknown> },
      pt: { translation: pt as Record<string, unknown> },
      zh: { translation: zh as Record<string, unknown> },
      ja: { translation: ja as Record<string, unknown> },
      ko: { translation: ko as Record<string, unknown> },
      ru: { translation: ru as Record<string, unknown> },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export default i18n;
