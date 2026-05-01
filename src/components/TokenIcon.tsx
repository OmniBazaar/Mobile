/**
 * TokenIcon — round token logo with a colour-fallback chip when the
 * remote image fails to load.
 *
 * Uses the same TrustWallet `assets` CDN that WebApp + Wallet use, so
 * a token's logo looks identical across all three clients. For
 * native gas tokens we map the chain ID to the chain's slug and use
 * the chain's `info/logo.png`. For OmniCoin / XOM we ship our own
 * fallback (the platform brand) so the user never sees a broken
 * image for the home chain.
 *
 * @module components/TokenIcon
 */

import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '@theme/colors';

/** Props for {@link TokenIcon}. */
export interface TokenIconProps {
  /** Chain ID where the token lives. */
  chainId: number;
  /** Token symbol used as the fallback chip text + logo lookup hint. */
  symbol: string;
  /** ERC-20 contract address; omit for native gas tokens. */
  contractAddress?: string;
  /** Pixel size; defaults to 32. */
  size?: number;
}

/** Map EVM chain ID → TrustWallet `assets` blockchain slug. */
function trustwalletSlug(chainId: number): string | undefined {
  switch (chainId) {
    case 1:
      return 'ethereum';
    case 10:
      return 'optimism';
    case 56:
      return 'smartchain';
    case 137:
      return 'polygon';
    case 8453:
      return 'base';
    case 42161:
      return 'arbitrum';
    case 43114:
      return 'avalanchec';
    default:
      return undefined;
  }
}

/**
 * Resolve the canonical logo URL for a token, or undefined when no
 * logo source is mapped (caller falls back to the chip).
 *
 * @param chainId - EVM chain ID.
 * @param contractAddress - ERC-20 contract address; omit for native.
 * @returns HTTPS image URL, or undefined.
 */
function logoUrl(chainId: number, contractAddress?: string): string | undefined {
  const slug = trustwalletSlug(chainId);
  if (slug === undefined) return undefined;
  if (contractAddress === undefined) {
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${slug}/info/logo.png`;
  }
  // TrustWallet expects the EIP-55-checksummed address. We let the
  // CDN return 404 if our caller's address isn't in their database;
  // the failure surfaces as the chip fallback.
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${slug}/assets/${contractAddress}/logo.png`;
}

/**
 * Render a token logo with chip fallback.
 *
 * @param props - See {@link TokenIconProps}.
 * @returns JSX.
 */
export default function TokenIcon(props: TokenIconProps): JSX.Element {
  const size = props.size ?? 32;
  const url = logoUrl(props.chainId, props.contractAddress);
  const [errored, setErrored] = useState(false);
  if (url === undefined || errored) {
    return (
      <View
        style={[
          styles.chip,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: chipColor(props.symbol),
          },
        ]}
      >
        <Text style={[styles.chipText, { fontSize: Math.max(10, size / 3) }]}>
          {props.symbol.slice(0, 3).toUpperCase()}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: url }}
      onError={(): void => setErrored(true)}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      accessibilityLabel={props.symbol}
    />
  );
}

/** Stable per-symbol pastel for the fallback chip. */
function chipColor(symbol: string): string {
  let h = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    h = (h * 31 + symbol.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue},45%,32%)`;
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', justifyContent: 'center' },
  chipText: { color: colors.textPrimary, fontWeight: '700', letterSpacing: 0.5 },
});
