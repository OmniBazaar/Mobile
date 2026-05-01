/**
 * Haptic-feedback wrappers used across the Mobile UI.
 *
 * iOS supports the full impact + notification taxonomy via Taptic
 * Engine; Android provides coarser equivalents. expo-haptics handles
 * the platform split — the helpers here just expose a Mobile-flavoured
 * vocabulary that maps cleanly to UX events.
 *
 * Usage policy:
 *   - `select()` on tab-switch + segmented-control changes.
 *   - `impactLight()` on tap-confirm of a non-destructive action.
 *   - `impactMedium()` on transaction confirm (Send, Buy, Stake, etc.).
 *   - `success()` after a relay submit returns a tx hash.
 *   - `warning()` when a flow surfaces a non-fatal error toast.
 *   - `error()` when a flow surfaces a destructive failure.
 *
 * @module utils/haptics
 */

import * as Haptics from 'expo-haptics';

/** Light tab-switch / picker change. */
export function select(): void {
  void Haptics.selectionAsync();
}

/** Light press confirmation. */
export function impactLight(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Medium press confirmation (tx-confirm, sign). */
export function impactMedium(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Heavy tap (destructive confirm — delete, sign-out). */
export function impactHeavy(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/** Success vibration after a successful tx submit. */
export function success(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Warning vibration. */
export function warning(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/** Error vibration. */
export function error(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
