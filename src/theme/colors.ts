/**
 * OmniBazaar color palette — dark-mode-first.
 *
 * Every hex is referenced by name so future theming (light mode,
 * high-contrast) only touches this file.
 */

export const colors = {
  /** Base background — near-black with a hint of blue. */
  background: '#0f1117',
  /** Secondary surface — cards, input backgrounds. */
  surface: '#1a1d24',
  /** Elevated surface — modals, sheets. */
  surfaceElevated: '#232730',
  /** Primary brand — OmniBazaar gold. */
  primary: '#F5B100',
  /** Primary variant used when pressed / hover. */
  primaryDim: '#C99200',
  /** Accent for links and secondary actions. */
  accent: '#4f46e5',
  /** Success state (gains, confirmations). */
  success: '#22C55E',
  /** Danger / error state (losses, destructive actions). */
  danger: '#EF4444',
  /** Warning / caution state. */
  warning: '#F59E0B',

  /** High-contrast foreground on dark surfaces. */
  textPrimary: '#ffffff',
  /** Secondary foreground (muted). */
  textSecondary: '#cccccc',
  /** Placeholder / disabled text. */
  textMuted: '#6b7280',

  /** Default border color for inputs, dividers. */
  border: '#374151',
  /** Slightly lighter divider for card boundaries. */
  borderSoft: '#2a2e37',
} as const;

export type ColorKey = keyof typeof colors;
